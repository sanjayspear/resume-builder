/*
 * Spell check (Content tips): real English dictionaries (US and UK), run on
 * the device. Run with: npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { spellingTips } from "@/lib/ats/tips";
import { textToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import { createChecker } from "@/lib/spell/checker";
import { spellTargets } from "@/lib/spell/targets";
import { qaResume } from "./fixtures/qaResume";

// The same dictionary files the app serves (copied into public/ by "postinstall").
const checker = createChecker(
  ["en-US", "en-GB"].map((name) => ({
    aff: readFileSync(`public/dictionaries/${name}.aff`),
    dic: readFileSync(`public/dictionaries/${name}.dic`),
  })),
);

function spelling(data: ResumeData) {
  const targets = spellTargets(data);
  const results = new Map(targets.map((t) => [t.word, checker.check(t.word)]));
  return spellingTips(targets, results);
}
const withSummary = (summary: string): ResumeData => ({ ...qaResume(), summary: textToDoc(summary) });
const flagged = (summary: string) => spelling(withSummary(summary)).map((t) => t.title);

describe("spelling mistakes are found, with suggestions", () => {
  for (const [typo, fix] of [
    ["recieved", "received"],
    ["managment", "management"],
    ["feedbak", "feedback"],
  ] as const) {
    test(`“${typo}” → “${fix}”`, () => {
      const tip = spelling(withSummary(`We ${typo} it in 2024.`)).find((t) => t.title === `“${typo}”`);
      assert.ok(tip, `“${typo}” not flagged`);
      assert.match(tip.message, new RegExp(`Did you mean .*“${fix}”`));
      assert.equal(tip.field, "summary");
      assert.equal(tip.id, `spell:${typo}`, "the id is the word, so Ignore word applies everywhere");
    });
  }

  test("a misspelled first word of a sentence is checked (not mistaken for a name)", () => {
    assert.deepEqual(flagged("Recieved the 2023 award."), ["“Recieved”"]);
  });

  test("each part of a hyphenated word is checked", () => {
    assert.deepEqual(flagged("Led cross-functionl teams of 8."), ["“functionl”"]);
  });

  test("one tip per word, listing where it appears", () => {
    const data = withSummary("We recieved 3 awards.");
    data.experience[0].jobTitle = "Recieved Engineer";
    const tips = spelling(data);
    assert.equal(tips.filter((t) => t.id === "spell:recieved").length, 1);
    assert.match(tips[0].message, /in Summary/);
  });
});

describe("correct text is never flagged", () => {
  test("British and American spellings are both accepted", () => {
    assert.deepEqual(flagged("The programme and the program; optimisation and optimization; colour and color; centre and center; labour and labor."), []);
  });

  test("names, tools and acronyms are not checked", () => {
    assert.deepEqual(flagged("Worked at Quillmere with Kubernetes, TestNG, Karate and SQL on QA for the CI/CD of iOS apps (v2.0, Web3)."), []);
  });

  test("everyday workplace words the dictionaries lack are accepted", () => {
    assert.deepEqual(flagged("Led onboarding, a scalable rollout, the roadmap and one workstream for wellbeing."), []);
  });

  test("possessives and contractions are fine", () => {
    assert.deepEqual(flagged("The team's results didn't drop."), []);
  });

  test("the sample resume and the QA resume have no spelling tips", () => {
    assert.deepEqual(spelling(sampleResume), []);
    assert.deepEqual(spelling(qaResume()), []);
  });
});
