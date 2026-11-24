/*
 * ATS check, Phase 1: readability (from the real PDF) and the structure
 * checklist (from the form data). Run with: npm test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readabilityChecks, TWO_COLUMN_WARNING } from "@/lib/ats/readability";
import { dateStyle, structureChecks } from "@/lib/ats/structure";
import { summaryLine } from "@/lib/ats/summary";
import type { Check } from "@/lib/ats/types";
import { bulletsToDoc, textToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import type { TemplateId } from "@/lib/templates";
import { qaResume } from "./fixtures/qaResume";
import { pdfReading, renderPdf } from "./helpers/pdf";

const withTemplate = (data: ResumeData, template: TemplateId): ResumeData => ({ ...data, style: { ...data.style, template } });
const byId = (checks: Check[], id: string) => {
  const found = checks.find((c) => c.id === id);
  assert.ok(found, `no check "${id}"`);
  return found;
};

/** Runs the whole Phase 1 check like the app: render the real PDF, read it, check. */
async function fullCheck(data: ResumeData) {
  const reading = await pdfReading(await renderPdf(data));
  const readability = readabilityChecks(data, reading);
  const structure = structureChecks(data, { pageCount: reading.extracted.pageCount });
  return {
    checks: [...readability, ...structure],
    line: `${summaryLine("Readability", readability)} · ${summaryLine("Structure", structure)}`,
  };
}

describe("the sample resume", () => {
  test("Modern ATS: everything passes", async () => {
    const { checks, line } = await fullCheck(withTemplate(sampleResume, "modern-ats"));
    assert.equal(line, "Readability: Passed · Structure: Passed", JSON.stringify(checks.filter((c) => c.status !== "pass" && c.status !== "info")));
  });

  test("Classic Sidebar: one warning, the two-column layout, with a switch button", async () => {
    const { checks, line } = await fullCheck(withTemplate(sampleResume, "classic"));
    assert.equal(line, "Readability: 1 warning - two-column layout · Structure: Passed");
    const order = byId(checks, "reading-order");
    assert.equal(order.message, TWO_COLUMN_WARNING);
    assert.equal(order.action, "switch-to-modern-ats");
    assert.equal(byId(checks, "words").status, "pass", "every word is still readable in Classic");
  });

  test("Classic with company logos: images are reported as logos, nothing lost", async () => {
    const logo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";
    const data = withTemplate({ ...sampleResume, experience: sampleResume.experience.map((j) => ({ ...j, logo })) }, "classic");
    const images = byId((await fullCheck(data)).checks, "images");
    assert.equal(images.status, "pass");
    assert.match(images.message, /^3 company logos are images; the company names are also real text/);
  });
});

describe("readability problems are detected", () => {
  test("a word that doesn't come out of the PDF as typed", async () => {
    const data = withTemplate(qaResume(), "modern-ats");
    const reading = await pdfReading(await renderPdf(data));
    // Simulate the old bug: the PDF text says "&EST" where the resume says "REST".
    reading.extracted = { ...reading.extracted, streamText: reading.extracted.streamText.replaceAll("REST", "&EST") };
    const words = byId(readabilityChecks(data, reading), "words");
    assert.equal(words.status, "fail");
    assert.match(words.message, /“REST”/);
  });

  test("a broken glyph-to-letter map", async () => {
    const data = withTemplate(qaResume(), "modern-ats");
    const reading = { ...(await pdfReading(await renderPdf(data))), mapProblems: ["map 2: bad entry <>"] };
    const check = byId(readabilityChecks(data, reading), "characters");
    assert.equal(check.status, "fail");
    assert.equal(check.reason, "broken characters");
  });

  test("the QA resume (with a hyphenated word and metrics) reads correctly in both templates", async () => {
    for (const template of ["modern-ats", "classic"] as const) {
      const checks = (await fullCheck(withTemplate(qaResume(), template))).checks;
      assert.equal(byId(checks, "words").status, "pass", `${template}: ${byId(checks, "words").message}`);
      assert.equal(byId(checks, "characters").status, "pass");
      assert.equal(byId(checks, "headings").status, "pass");
    }
  });
});

describe("structure checklist", () => {
  test("the QA resume's mixed date styles are flagged, with an example of each style", () => {
    const check = byId(structureChecks(qaResume()), "date-style");
    assert.equal(check.status, "warn");
    assert.match(check.message, /“Sept 2017” \(non-standard short form; use “Sep”\)/);
    assert.match(check.message, /“Oct 2022” \(short month\)/);
    assert.match(check.message, /“April 2025” \(full month\)/);
    assert.equal(check.field, "experience.2.startDate", "Go to field points at the Sept date");
  });

  test("date styles are recognised", () => {
    assert.equal(dateStyle("Oct 2022"), "short");
    assert.equal(dateStyle("October 2022"), "full");
    assert.equal(dateStyle("May 2022"), "both");
    assert.equal(dateStyle("Sept 2017"), "sept");
    assert.equal(dateStyle("2019"), "year");
    assert.equal(dateStyle("03/2023"), "numeric");
    assert.equal(dateStyle("2023-03"), "numeric");
  });

  test("consistent dates pass, including May (which fits either style)", () => {
    const data = qaResume();
    data.experience[0].startDate = "Apr 2025";
    data.experience[1].endDate = "Apr 2025";
    data.experience[2].startDate = "May 2017";
    assert.equal(byId(structureChecks(data), "date-style").status, "pass");
  });

  test("years only is a warning (add months)", () => {
    const data = sampleResume.experience.map((j) => ({ ...j, startDate: "2020", endDate: j.isCurrent ? "" : "2021" }));
    const check = byId(structureChecks({ ...sampleResume, experience: data }), "date-style");
    assert.equal(check.reason, "dates without months");
  });

  test("missing LinkedIn is a warning that points at the LinkedIn field", () => {
    const data = qaResume();
    data.personal.linkedin = "";
    const check = byId(structureChecks(data), "linkedin");
    assert.equal(check.status, "warn");
    assert.equal(check.field, "personal.linkedin");
  });

  test("a link that isn't a LinkedIn profile is a warning", () => {
    const data = qaResume();
    data.personal.linkedin = "github.com/arjun";
    assert.equal(byId(structureChecks(data), "linkedin").reason, "LinkedIn link looks wrong");
  });

  test("missing phone and invalid email are problems; missing city is a warning", () => {
    const data = qaResume();
    data.personal.phone = "";
    data.personal.email = "arjun.example.com";
    data.personal.location = "";
    const checks = structureChecks(data);
    assert.equal(byId(checks, "phone").status, "fail");
    assert.equal(byId(checks, "email").reason, "invalid email");
    assert.equal(byId(checks, "city").status, "warn");
  });

  test("a job without a company is a problem pointing at that field", () => {
    const data = qaResume();
    data.experience[1].company = "";
    const check = byId(structureChecks(data), "jobs");
    assert.equal(check.status, "fail");
    assert.equal(check.field, "experience.1.company");
    assert.match(check.message, /QA Engineer: no company/);
  });

  test("oldest-first job order is a warning", () => {
    const check = byId(structureChecks({ ...qaResume(), experienceOrder: "oldest" }), "order");
    assert.equal(check.status, "warn");
    assert.equal(check.field, "experienceOrder");
  });

  test("a 3-page resume is a warning; 1–2 pages pass", async () => {
    assert.equal(byId(structureChecks(qaResume(), { pageCount: 2 }), "length").status, "pass");
    // A real 3-page PDF: the sample with three copies of every job.
    const long = withTemplate({ ...sampleResume, experience: [...sampleResume.experience, ...sampleResume.experience, ...sampleResume.experience] }, "modern-ats");
    const { checks } = await fullCheck(long);
    const length = byId(checks, "length");
    assert.equal(length.status, "warn");
    assert.match(length.reason ?? "", /^[3-9] pages$/);
  });

  test("summary length: too short and too long are warnings", () => {
    assert.equal(byId(structureChecks({ ...qaResume(), summary: textToDoc("QA engineer.") }), "summary").reason, "summary too short");
    const long = Array.from({ length: 130 }, () => "word").join(" ");
    assert.equal(byId(structureChecks({ ...qaResume(), summary: textToDoc(long) }), "summary").reason, "summary too long");
  });

  test("the file name matches what Download saves", () => {
    assert.match(byId(structureChecks(qaResume()), "file-name").message, /“Arjun-Rao-Resume\.pdf”/);
  });

  test("empty entries left by Clear form don't count as incomplete jobs", () => {
    const data = qaResume();
    data.experience.push({ ...data.experience[0], startDate: "", endDate: "", isCurrent: false, jobTitle: "", company: "", location: "", description: bulletsToDoc([]) });
    assert.equal(byId(structureChecks(data), "jobs").status, "pass");
  });
});

test("the summary line keeps readability and structure apart", async () => {
  const data = withTemplate(qaResume(), "modern-ats");
  data.personal.linkedin = "";
  data.experience[0].startDate = "Apr 2025";
  data.experience[1].endDate = "Apr 2025";
  data.experience[2].startDate = "Sep 2017";
  assert.equal((await fullCheck(data)).line, "Readability: Passed · Structure: 1 warning - no LinkedIn");
});

describe("summary line", () => {
  const check = (status: Check["status"], reason?: string): Check => ({ id: reason ?? status, status, title: "T", message: "", why: "", reason });
  test("says why, problems first, at most three reasons", () => {
    assert.equal(summaryLine("Readability", [check("pass"), check("info")]), "Readability: Passed");
    assert.equal(summaryLine("Readability", [check("warn", "two-column layout")]), "Readability: 1 warning - two-column layout");
    assert.equal(
      summaryLine("Readability", [check("warn", "two-column layout"), check("fail", "no phone"), check("warn", "no LinkedIn")]),
      "Readability: 1 problem, 2 warnings - no phone, two-column layout, no LinkedIn",
    );
    assert.equal(
      summaryLine("Readability", ["a", "b", "c", "d"].map((r) => check("warn", r))),
      "Readability: 4 warnings - a, b, c, …",
    );
    assert.equal(summaryLine("Readability", [], { pending: true }), "Readability: Checking…");
  });
});
