/*
 * Ligature regression test: renders text full of "ft", "ff", "ffi", "ffl"
 * in every font and both templates, and checks the PDF text layer keeps
 * every letter. Run with: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { textToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import type { TemplateId } from "@/lib/templates";
import { FONT_VALUES, type FontFamily } from "@/lib/theme";
import { extractPdf, multiLetterGlyphs, renderPdf } from "./helpers/pdf";

// Words that most fonts draw with ligature glyphs.
const WORDS = ["Software", "efficiency", "affiliated", "staffing", "workflow", "shift"];
const SENTENCE = WORDS.join(" ");

function resumeWith(template: TemplateId, fontFamily: FontFamily): ResumeData {
  return {
    ...sampleResume,
    // Regular text, plus a heading (bold/semibold) and the sidebar's own text.
    summary: textToDoc(SENTENCE),
    personal: { ...sampleResume.personal, jobTitle: SENTENCE },
    sidebarSummary: SENTENCE,
    style: { ...sampleResume.style, fontFamily, template },
  };
}

// Classic Sidebar: every selectable font. Modern ATS always uses Inter.
const cases: [TemplateId, FontFamily][] = [
  ...FONT_VALUES.map((font): [TemplateId, FontFamily] => ["classic", font]),
  ["modern-ats", "SourceSans3"],
];

for (const [template, font] of cases) {
  const label = template === "classic" ? `${template}, ${font}` : template;
  test(`text layer keeps every letter: ${label}`, async () => {
    const pdf = await renderPdf(resumeWith(template, font));

    const text = (await extractPdf(pdf)).pages.flat().join("\n");
    for (const word of WORDS) {
      assert.match(text, new RegExp(`\\b${word}\\b`), `"${word}" missing from extracted text`);
    }

    const { cmaps, entries } = await multiLetterGlyphs(pdf);
    assert.ok(cmaps > 0, "no ToUnicode maps found; the check below would be meaningless");
    assert.deepEqual(entries, [], `glyphs that stand for several letters (ligatures): ${entries.join(", ")}`);
  });
}
