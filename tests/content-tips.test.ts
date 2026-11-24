/*
 * ATS check, Phase 3: content tips. Run with: npm test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contentTips, tipsSummary, type Tip, type TipCategory } from "@/lib/ats/tips";
import { bulletsToDoc, textToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import { qaResume } from "./fixtures/qaResume";

const ofCategory = (tips: Tip[], category: TipCategory) => tips.filter((t) => t.category === category);
/** The QA resume with the first job's bullets replaced. */
function withBullets(bullets: string[]): ResumeData {
  const data = qaResume();
  data.experience[0].description = bulletsToDoc(bullets);
  return data;
}

describe("sensible tips for the sample resumes", () => {
  test("Maya is a model example: exactly one tip left, to demonstrate the feature", () => {
    const tips = contentTips(sampleResume);
    assert.deepEqual(
      tips.map((t) => t.title),
      ["Senior Operations Manager: 1 of 8 bullets without a number"],
    );
    assert.match(tips[0].message, /Lead a weekly continuous-improvement meeting/);
  });

  test("Maya: at most 8 bullets per job", () => {
    for (const job of sampleResume.experience) {
      const list = job.description.content.find((b) => b.type === "bulletList");
      assert.ok(list && list.type === "bulletList" && list.content.length <= 8, `${job.jobTitle}`);
    }
  });

  test("“Coached four shift leads” and “zero lost-time incidents” count as numbers", () => {
    const numbers = ofCategory(contentTips(sampleResume), "numbers").map((t) => t.message).join(" ");
    assert.doesNotMatch(numbers, /Coached four/);
    assert.doesNotMatch(numbers, /Ran the site safety/);
  });
});

describe("weak openings", () => {
  for (const [bullet, verb] of [
    ["Responsible for the regression suite and its 300 tests.", "Led"],
    ["Worked on the payments API test suite with 40 tests.", "Built"],
    ["Helped with release testing for 12 releases.", "Supported"],
    ["Duties included writing 200 test cases.", "Managed"],
  ] as const) {
    test(`“${bullet.split(" ").slice(0, 2).join(" ")}…” gets a stronger verb`, () => {
      const tip = ofCategory(contentTips(withBullets([bullet, "Cut regression time by 60%."])), "weak-start")[0];
      assert.ok(tip, "expected a weak-opening tip");
      assert.match(tip.message, new RegExp(`“${verb}”`));
      assert.equal(tip.field, "experience.0.description");
    });
  }

  test("strong openings get no tip", () => {
    assert.deepEqual(ofCategory(contentTips(withBullets(["Led a team of 6 testers.", "Cut regression time by 60%."])), "weak-start"), []);
  });
});

describe("bullets", () => {
  test("bullets without a number are listed per job", () => {
    const tip = ofCategory(contentTips(withBullets(["Wrote test plans for new features.", "Cut regression time by 60%."])), "numbers").find((t) => t.field === "experience.0.description");
    assert.ok(tip);
    assert.match(tip.title, /1 of 2 bullets without a number/);
    assert.match(tip.message, /Add a number, %, time saved or scale if you can/);
  });

  test("a bullet over 35 words is long", () => {
    const long = Array.from({ length: 38 }, (_, i) => `word${i}`).join(" ");
    assert.equal(ofCategory(contentTips(withBullets([long, "Cut regression time by 60%."])), "long").length, 1);
  });

  test("fewer than 2 or more than 8 bullets in a job", () => {
    assert.match(ofCategory(contentTips(withBullets(["Cut regression time by 60%."])), "bullet-count")[0].message, /Add a few more bullets/);
    const nine = Array.from({ length: 9 }, (_, i) => `Shipped release ${i + 1} on time.`);
    assert.match(ofCategory(contentTips(withBullets(nine)), "bullet-count")[0].message, /Keep the strongest 6–8/);
  });

  test("the same opening verb in 3 or more bullets", () => {
    const tips = contentTips(withBullets(["Led 3 releases.", "Led a 5-person team.", "Led the 2024 migration."]));
    const tip = ofCategory(tips, "repeated-verb")[0];
    assert.equal(tip.title, "“Led” starts 3 bullets");
    assert.match(tip.message, /“Directed”/);
  });
});

describe("clichés", () => {
  test("a cliché without evidence is flagged; with a number in the same sentence it isn't", () => {
    const data = qaResume();
    data.summary = textToDoc("Hardworking team player and results-driven tester. Results-driven: cut regression time by 60%.");
    const titles = ofCategory(contentTips(data), "cliche").map((t) => t.title).sort();
    // All three in the first sentence; the second sentence has evidence, so it adds nothing.
    assert.deepEqual(titles, ["“hardworking”", "“results-driven”", "“team player”"]);
  });
});

describe("personal details recruiters don't need", () => {
  test("date of birth, marital status and a full address are flagged", () => {
    const data = qaResume();
    data.summary = textToDoc("Date of birth: 05/05/1992. Marital status: Married. QA engineer with 8 years of experience.");
    data.personal.location = "12 Example Road, Exampleton 00000";
    const titles = ofCategory(contentTips(data), "personal").map((t) => t.title);
    assert.ok(titles.includes("Date of birth or age"), titles.join(", "));
    assert.ok(titles.includes("Marital status"));
    assert.ok(titles.includes("Full home address"));
  });

  test("ordinary text doesn't trigger them (“single source of truth”, a city)", () => {
    const data = qaResume();
    data.summary = textToDoc("Built a single source of truth for test results across 3 teams.");
    data.personal.location = "Bengaluru, India";
    assert.deepEqual(ofCategory(contentTips(data), "personal"), []);
  });
});

describe("dismissing", () => {
  test("tip ids stay the same between runs, and change when the text changes", () => {
    const a = contentTips(withBullets(["Worked on the API suite of 40 tests.", "Cut time by 60%."]));
    const b = contentTips(withBullets(["Worked on the API suite of 40 tests.", "Cut time by 60%."]));
    const c = contentTips(withBullets(["Worked on the UI suite of 40 tests.", "Cut time by 60%."]));
    const weak = (tips: Tip[]) => ofCategory(tips, "weak-start")[0].id;
    assert.equal(weak(a), weak(b));
    assert.notEqual(weak(a), weak(c));
  });

  test("the summary counts only tips that aren't dismissed", () => {
    assert.equal(tipsSummary(4), "Content tips: 4 tips");
    assert.equal(tipsSummary(1), "Content tips: 1 tip");
    assert.equal(tipsSummary(0), "Content tips: none");
  });
});
