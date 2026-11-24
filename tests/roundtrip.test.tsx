/*
 * Round trip: text in -> PDF -> text out must be identical, for every
 * letter, digit and common punctuation mark, in both templates.
 * Run with: npm test
 *
 * The PDF is rendered the way the app does it: after other PDFs in the same
 * session (the live preview renders many). That's what used to break the
 * text layer: see repairGlyphCache in src/pdf/fonts.ts.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { textToDoc } from "@/lib/richText";
import { emptyResume, type ResumeData } from "@/lib/schema";
import type { TemplateId } from "@/lib/templates";
import { ATS_HEADER_VALUES, FONT_VALUES, type AtsHeaderStyle, type FontFamily } from "@/lib/theme";
import { Document, Page, renderToBuffer, Text } from "@react-pdf/renderer";
import { DISPLAY_FONT, repairGlyphCache } from "@/pdf/fonts";
import { NO_LIGATURES } from "@/pdf/shared";
import { extractPdf, multiLetterGlyphs, renderPdf, toUnicodeProblems } from "./helpers/pdf";

// Short lines, so each fits on one line in both templates.
const LINES = [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  `( ) ' " : ; & - – • / | @ . ,`,
  "’ ‘ “ ” Fabrikam’s “quoted” ‘single’",
  "REST TestNG Azure Software efficiency",
  "affiliated cross-browser E-Learning",
  "Validated Fabrikam's (2017) R&D: 99.4%;",
  "CI/CD | QA@example.net – sq ft, shift, staff",
];

/** Only a name and the test text: nothing else on the page that could share a line with it. */
function resume(
  summary: string,
  template: TemplateId,
  fontFamily: FontFamily = "SourceSans3",
  atsHeader: AtsHeaderStyle = "banner",
): ResumeData {
  const data = emptyResume();
  data.personal.fullName = "Round Trip";
  data.summary = textToDoc(summary);
  data.style = { ...data.style, template, fontFamily, atsHeader };
  return data;
}

/** The test text as extracted: the lines from "ABC…" onwards, joined with spaces. */
async function roundTrip(data: ResumeData) {
  const pdf = await renderPdf(data);
  const lines = (await extractPdf(pdf)).pages.flat();
  const start = lines.indexOf(LINES[0]);
  assert.ok(start >= 0, `first line not found in: ${JSON.stringify(lines)}`);
  return { pdf, text: lines.slice(start, start + LINES.length).join(" ") };
}

/** Text that makes the font subsetter cache "component" glyphs (’ inside ', the dot of i…). */
const PRIMER = "Fabrikam's team: it is \"fine\", i.e. okay; j! 1.5 ... I'm done.";

// Modern ATS (always Inter + Montserrat) in each header style; Classic in every font.
const cases: [TemplateId, FontFamily, AtsHeaderStyle][] = [
  ...ATS_HEADER_VALUES.map((header): [TemplateId, FontFamily, AtsHeaderStyle] => ["modern-ats", "SourceSans3", header]),
  ...FONT_VALUES.map((font): [TemplateId, FontFamily, AtsHeaderStyle] => ["classic", font, "banner"]),
];

describe("text in = text out", () => {
  for (const [template, font, header] of cases) {
    const label = template === "classic" ? `classic, ${font}` : `modern-ats, ${header} header`;

    test(`${label}: every character survives, also after earlier PDFs in the same session`, async () => {
      // Like the live preview: other PDFs first, then the one we check (twice).
      await renderPdf(resume(PRIMER, template, font, header));
      await renderPdf(resume(PRIMER.toUpperCase(), template, font, header));
      for (const attempt of [1, 2]) {
        const { pdf, text } = await roundTrip(resume(LINES.join("\n"), template, font, header));
        assert.equal(text, LINES.join(" "), `render ${attempt}: extracted text differs`);
        assert.deepEqual(toUnicodeProblems(pdf), [], `render ${attempt}: broken glyph-to-letter map`);
        assert.deepEqual(multiLetterGlyphs(pdf).entries, [], `render ${attempt}: ligature glyphs present`);
      }
    });
  }
});

describe("no automatic hyphenation", () => {
  const LONG = Array.from({ length: 8 }, () => "Internationalization Characterization Telecommunications Implementation").join(" ");
  for (const template of ["classic", "modern-ats"] as const) {
    test(`${template}: long words wrap whole, never split with a hyphen`, async () => {
      const lines = (await extractPdf(await renderPdf(resume(LONG, template)))).pages.flat();
      const body = lines.filter((l) => /Internationalization|Characterization|Telecommunications|Implementation/.test(l));
      assert.ok(body.length >= 3, "text should wrap over several lines");
      const words = new Set(LONG.split(" "));
      for (const line of body) {
        for (const word of line.split(" ")) assert.ok(words.has(word), `"${word}" is not a whole word (line: "${line}")`);
      }
    });
  }
});

describe("display font (Montserrat: Modern ATS names and headings)", () => {
  // Rendered directly, so every character goes through Montserrat, in both
  // weights and in capitals (headings are uppercase).
  const lines = [...LINES, ...LINES.map((l) => l.toUpperCase())];
  for (const fontWeight of [600, 700]) {
    test(`Montserrat ${fontWeight}: every character survives`, async () => {
      for (const attempt of [1, 2]) {
        repairGlyphCache();
        const pdf = await renderToBuffer(
          <Document>
            <Page size="A4" style={{ padding: 40, fontFamily: DISPLAY_FONT, fontWeight, fontSize: 12, fontFeatureSettings: NO_LIGATURES }}>
              {lines.map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
            </Page>
          </Document>,
        );
        const extracted = (await extractPdf(pdf)).pages.flat();
        assert.deepEqual(extracted, lines, `render ${attempt}`);
        assert.deepEqual(toUnicodeProblems(pdf), [], `render ${attempt}: broken glyph-to-letter map`);
        assert.deepEqual(multiLetterGlyphs(pdf).entries, [], `render ${attempt}: ligature glyphs present`);
      }
    });
  }

  for (const header of ATS_HEADER_VALUES) {
    test(`${header} header: a name with accents and punctuation extracts exactly`, async () => {
      const data = resume("Summary.", "modern-ats", "SourceSans3", header);
      data.personal.fullName = "Zoë O’Brien-Smith & Ana (QA)";
      const lines = (await extractPdf(await renderPdf(data))).pages.flat();
      assert.equal(lines[0], "Zoë O’Brien-Smith & Ana (QA)");
    });
  }
});
