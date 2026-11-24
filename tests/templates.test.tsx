/*
 * Both templates, rendered from the "Load sample data" resume, read back the
 * way a resume scanner (ATS) reads them. Run with: npm test
 *
 * "Stream order" = the order text is stored in the PDF file, which is the
 * order an ATS reads it. "Lines" = what you see on the page.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bulletsToDoc, flattenDoc, richTextToPlain, textToDoc, type RichDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import type { TemplateId } from "@/lib/templates";
import { extractPdf, imageCount, multiLetterGlyphs, renderPdf, squash, type ExtractedPdf } from "./helpers/pdf";

const withTemplate = (data: ResumeData, template: TemplateId): ResumeData => ({
  ...data,
  style: { ...data.style, template },
});

/** Plain text of each bullet/paragraph in a description. */
const unitsOf = (doc: RichDoc) =>
  flattenDoc(doc).map((u) => squash(u.inlines.map((i) => (i.type === "text" ? i.text : " ")).join("")));

/** Renders once per template and shares the result between tests. */
const rendered = new Map<TemplateId, Promise<{ pdf: Buffer; text: ExtractedPdf }>>();
function sample(template: TemplateId) {
  if (!rendered.has(template)) {
    rendered.set(
      template,
      renderPdf(withTemplate(sampleResume, template)).then(async (pdf) => ({ pdf, text: await extractPdf(pdf) })),
    );
  }
  return rendered.get(template)!;
}

const KEYWORDS = ["Software", "efficiency", "affiliated"];

/* ---------- Both templates ---------- */

for (const template of ["classic", "modern-ats"] as const) {
  describe(`${template}: sample resume`, () => {
    test("keywords with letter pairs (ft, ff, ffi) are spelled correctly", async () => {
      const { pdf, text } = await sample(template);
      const all = text.pages.flat().join("\n");
      for (const word of KEYWORDS) assert.match(all, new RegExp(`\\b${word}\\b`), `"${word}" not found`);
      assert.doesNotMatch(all, /\bSofware\b|\beficiency\b|\bafiliated\b/, "a word lost letters");
      assert.deepEqual(multiLetterGlyphs(pdf).entries, [], "PDF still contains ligature glyphs");
    });

    test("all section headings are present", async () => {
      const { text } = await sample(template);
      const pieces = new Set(text.items.map((i) => i.str.trim()));
      const expected = ["SUMMARY", "SKILLS", "WORK EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "LANGUAGES"];
      for (const heading of expected) assert.ok(pieces.has(heading), `heading "${heading}" missing`);
    });

    test("every piece of content is in the PDF (switching templates never drops content)", async () => {
      const { text } = await sample(template);
      const all = squash(text.streamText);
      const content = [
        sampleResume.personal.fullName,
        sampleResume.personal.email,
        sampleResume.personal.linkedin,
        ...sampleResume.experience.flatMap((job) => [job.jobTitle, job.company, ...unitsOf(job.description)]),
        ...sampleResume.projects.flatMap((p) => [p.name, ...unitsOf(p.description)]),
        ...sampleResume.education.flatMap((e) => [e.degree, e.institution, e.year]),
        ...sampleResume.certifications.flatMap((c) => [c.name, c.issuer, c.year]),
        ...sampleResume.skillGroups.flatMap((g) => [g.name, ...g.skills.map((s) => s.value)]),
        ...sampleResume.languages.map((l) => l.name),
        squash(richTextToPlain(sampleResume.summary)),
      ];
      for (const piece of content) assert.ok(all.includes(squash(piece)), `missing: "${piece}"`);
    });

    test("page breaks never split a bullet or separate a job title from its first bullet", async () => {
      // Three copies of every job (made unique) so the content runs over several pages.
      const jobs = [1, 2, 3].flatMap((copy) =>
        sampleResume.experience.map((job, n) => ({
          ...job,
          jobTitle: `${job.jobTitle} (copy ${copy}-${n})`,
          description: bulletsToDoc(unitsOf(job.description).map((bullet, i) => `${bullet} [${copy}.${i}]`)),
        })),
      );
      // Where a page breaks depends on what comes before it. Pushing everything
      // down one line at a time (extra summary lines) makes page breaks land at
      // every possible spot inside the jobs, not just one lucky spot.
      const problems: string[] = [];
      for (let extraLines = 0; extraLines < 10; extraLines++) {
        const summary = textToDoc(
          [richTextToPlain(sampleResume.summary), ...Array.from({ length: extraLines }, (_, i) => `Extra line ${i}.`)].join("\n"),
        );
        const { pageStreams, pageCount } = await extractPdf(
          await renderPdf(withTemplate({ ...sampleResume, summary, experience: jobs }, template)),
        );
        assert.ok(pageCount >= 3, `expected at least 3 pages to test page breaks, got ${pageCount}`);
        const pages = pageStreams.map(squash);
        const pageOf = (needle: string) => pages.findIndex((p) => p.includes(squash(needle)));
        for (const job of jobs) {
          const bullets = unitsOf(job.description);
          for (const bullet of bullets) {
            if (pageOf(bullet) === -1) problems.push(`+${extraLines} lines: bullet split across pages: "${bullet.slice(0, 50)}…"`);
          }
          if (pageOf(job.jobTitle) !== pageOf(bullets[0])) {
            problems.push(`+${extraLines} lines: "${job.jobTitle}" is on a different page from its first bullet`);
          }
        }
      }
      assert.deepEqual(problems, []);
    });
  });
}

/* ---------- Modern ATS only ---------- */

describe("modern-ats: ATS rules", () => {
  test("reading order is name → contact → summary → skills → experience → projects → education → certifications → languages", async () => {
    const { text } = await sample("modern-ats");
    const steps = [
      sampleResume.personal.fullName,
      sampleResume.personal.email,
      "SUMMARY",
      "SKILLS",
      "WORK EXPERIENCE",
      "PROJECTS",
      "EDUCATION",
      "CERTIFICATIONS",
      "LANGUAGES",
    ];
    // In the file (what an ATS reads)...
    let from = 0;
    for (const step of steps) {
      const at = text.streamText.indexOf(step, from);
      assert.ok(at >= 0, `"${step}" not found after the previous step in stream order`);
      from = at + step.length;
    }
    // ...and on the page (what a recruiter sees): one column, top to bottom.
    const lines = text.pages.flat();
    const lineIndex = steps.map((step) => lines.findIndex((l) => l.includes(step)));
    assert.deepEqual([...lineIndex].sort((a, b) => a - b), lineIndex, `visual order differs: ${lineIndex}`);
  });

  test("name, job title and contact line come first; contact is one line separated by |", async () => {
    const { text } = await sample("modern-ats");
    const { fullName, jobTitle, location, phone, email, linkedin } = sampleResume.personal;
    assert.deepEqual(text.pages[0].slice(0, 3), [fullName, jobTitle, [location, phone, email, linkedin].join(" | ")]);
  });

  test('each job is one line: "Title | Company, City" then the date range, in that order', async () => {
    const { text } = await sample("modern-ats");
    const lines = text.pages.flat();
    for (const job of sampleResume.experience) {
      const dates = `${job.startDate} – ${job.isCurrent ? "Present" : job.endDate}`;
      const expected = `${job.jobTitle} | ${job.company}, ${job.location} ${dates}`;
      assert.ok(lines.includes(expected), `line not found: "${expected}"`);
      // Same order in the file: title, then company, then dates.
      const title = text.streamText.indexOf(`${job.jobTitle} `);
      const company = text.streamText.indexOf(job.company, title);
      const date = text.streamText.indexOf(dates, company);
      assert.ok(title >= 0 && company > title && date > company, `stream order wrong for "${job.jobTitle}"`);
    }
  });

  test('each date range sits on one line, written like "January 2024 – Present"', async () => {
    const { text } = await sample("modern-ats");
    const lines = text.pages.flat();
    for (const job of sampleResume.experience) {
      const dates = `${job.startDate} – ${job.isCurrent ? "Present" : job.endDate}`;
      assert.ok(
        lines.some((line) => line.endsWith(dates)),
        `"${dates}" is not on one line`,
      );
    }
  });

  test("bullets use the plain • character", async () => {
    const { text } = await sample("modern-ats");
    const lines = text.pages.flat();
    const firstBullet = unitsOf(sampleResume.experience[0].description)[0];
    assert.ok(lines.some((line) => line.startsWith(`• ${firstBullet.slice(0, 30)}`)), "bullet line not found");
  });

  test("skills are text lines grouped by category", async () => {
    const { text } = await sample("modern-ats");
    const lines = text.pages.flat();
    for (const group of sampleResume.skillGroups) {
      const expected = `${group.name}: ${group.skills.map((s) => s.value).join(", ")}`;
      assert.ok(lines.includes(expected), `skill line not found: "${expected}"`);
    }
  });

  test("fits on at most 2 pages", async () => {
    const { text } = await sample("modern-ats");
    assert.ok(text.pageCount <= 2, `${text.pageCount} pages`);
  });

  test("no images (logos are ignored) and no sidebar summary", async () => {
    const logo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
    const withLogos = { ...sampleResume, experience: sampleResume.experience.map((job) => ({ ...job, logo })) };
    // Control: Classic Sidebar does draw the logos, so the check below is meaningful.
    assert.ok(imageCount(await renderPdf(withTemplate(withLogos, "classic"))) > 0, "control: Classic should embed logos");

    const pdf = await renderPdf(withTemplate(withLogos, "modern-ats"));
    assert.equal(imageCount(pdf), 0, "Modern ATS must not contain images");
    const { streamText } = await extractPdf(pdf);
    assert.ok(!squash(streamText).includes(squash(sampleResume.sidebarSummary)), "sidebar summary must not appear");
  });

  test("optional sections are left out when empty", async () => {
    const { streamText } = await extractPdf(
      await renderPdf(withTemplate({ ...sampleResume, projects: [], certifications: [] }, "modern-ats")),
    );
    assert.ok(!streamText.includes("PROJECTS"), "PROJECTS heading shown without projects");
    assert.ok(!streamText.includes("CERTIFICATIONS"), "CERTIFICATIONS heading shown without certifications");
  });
});
