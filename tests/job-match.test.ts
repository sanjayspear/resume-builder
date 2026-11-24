/*
 * ATS check, Phase 2: job match. Keywords from a job description, matched
 * against the resume with word forms and synonyms. Run with: npm test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fillerData from "@/data/ats/filler.json";
import { extractKeywords, guessJobTitle, jobMatchChecks, jobMatchSummary, matchKeywords, stem, tokenize } from "@/lib/ats/keywords";
import {
  createResume,
  duplicateResume,
  emptyAtsState,
  importBackup,
  normalizeAtsState,
  toBackup,
  updateAtsState,
  type Library,
} from "@/lib/library";
import { bulletsToDoc, textToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import type { ResumeData } from "@/lib/schema";
import { OPS_JOB_DESCRIPTION, QA_JOB_DESCRIPTION } from "./fixtures/jobDescriptions";
import { qaResume } from "./fixtures/qaResume";

function run(data: ResumeData, jd: string, edits: { removed?: string[]; added?: string[] } = {}) {
  const results = matchKeywords(data, extractKeywords(jd, edits));
  const byLabel = (label: string) => results.find((r) => r.label.toLowerCase() === label.toLowerCase());
  return {
    results,
    byLabel,
    matched: results.filter((r) => r.matched).map((r) => r.label),
    missing: results.filter((r) => !r.matched).map((r) => r.label),
  };
}

describe("QA job description vs a QA resume", () => {
  const r = run(qaResume(), QA_JOB_DESCRIPTION);

  test("the core skills are matched", () => {
    for (const skill of ["Playwright", "Selenium", "REST API", "CI/CD", "Jenkins", "Karate", "Jira", "SQL"]) {
      assert.ok(r.matched.includes(skill), `${skill} should be matched (matched: ${r.matched.join(", ")})`);
    }
  });

  test("synonyms match: the ad says “continuous integration” and “RESTful APIs”, the resume says “CI/CD” and “REST APIs”", () => {
    assert.ok(/continuous integration/i.test(QA_JOB_DESCRIPTION) && !/CI\/CD/.test(QA_JOB_DESCRIPTION));
    assert.equal(r.byLabel("CI/CD")?.matched, true);
    assert.ok(/RESTful APIs/.test(QA_JOB_DESCRIPTION));
    assert.equal(r.byLabel("REST API")?.matched, true);
  });

  test("skills the resume doesn't have are reported missing", () => {
    for (const skill of ["Cypress", "Appium", "JMeter", "GitHub Actions"]) {
      assert.ok(r.missing.includes(skill), `${skill} should be missing (missing: ${r.missing.join(", ")})`);
    }
  });

  test("each match says where it was found", () => {
    assert.deepEqual(r.byLabel("Playwright")?.places, ["Summary", "Skills", "Experience"].filter((p) => r.byLabel("Playwright")!.places.includes(p as never)));
    assert.ok(r.byLabel("Karate")?.places.includes("Skills"));
    assert.ok(r.byLabel("Karate")?.places.includes("Experience"));
  });

  test("the summary line counts matches", () => {
    assert.match(jobMatchSummary(r.results, QA_JOB_DESCRIPTION), /^Job match: \d+ of \d+ keywords$/);
    assert.equal(jobMatchSummary([], ""), "Job match: no job description yet");
  });
});

describe("operations job description vs the Maya Fernandes sample", () => {
  const r = run(sampleResume, OPS_JOB_DESCRIPTION);

  test("sensible matches", () => {
    for (const skill of ["inventory management", "demand forecasting", "cycle counting", "WMS", "logistics", "OSHA"]) {
      assert.ok(r.matched.map((m) => m.toLowerCase()).includes(skill.toLowerCase()), `${skill} (matched: ${r.matched.join(", ")})`);
    }
  });

  test("“continuous improvement” in the ad matches the resume's “process improvements” wording via synonyms", () => {
    assert.equal(r.byLabel("process improvement")?.matched, true);
  });

  test("sensible gaps", () => {
    for (const skill of ["Six Sigma", "SAP", "Lean"]) {
      assert.ok(r.missing.map((m) => m.toLowerCase()).includes(skill.toLowerCase()), `${skill} (missing: ${r.missing.join(", ")})`);
    }
  });

  test("no false keyword-stuffing warnings (job titles repeat naturally)", () => {
    const checks = jobMatchChecks(sampleResume, r.results, OPS_JOB_DESCRIPTION, "");
    assert.deepEqual(checks.filter((c) => c.id.startsWith("overused")), []);
  });

  test("the job title from the ad isn't in the resume: a warning pointing at the headline", () => {
    const title = jobMatchChecks(sampleResume, r.results, OPS_JOB_DESCRIPTION, "").find((c) => c.id === "job-title")!;
    assert.equal(title.status, "warn");
    assert.match(title.message, /Warehouse Operations Manager/);
    assert.equal(title.field, "personal.jobTitle");
  });
});

describe("keywords never include filler", () => {
  const filler = new Set(fillerData.words.map((w) => w.toLowerCase()));
  for (const [name, jd] of [["QA", QA_JOB_DESCRIPTION], ["operations", OPS_JOB_DESCRIPTION]] as const) {
    test(`${name}: no keyword is a filler word or made only of filler words`, () => {
      for (const k of extractKeywords(jd)) {
        const words = tokenize(k.label);
        assert.ok(!words.every((w) => filler.has(w) || filler.has(stem(w))), `“${k.label}” is filler`);
      }
    });
  }

  test("a job ad made of filler gives no keywords", () => {
    const jd = "We are looking for a candidate to join our team. This role is a great opportunity at our company. The ideal candidate will join the team.";
    assert.deepEqual(extractKeywords(jd), []);
  });
});

describe("word forms and synonyms", () => {
  test("test / tests / testing and manage / managed / management are the same word", () => {
    assert.equal(stem("test"), stem("tests"));
    assert.equal(stem("test"), stem("testing"));
    assert.equal(stem("manage"), stem("managed"));
    assert.equal(stem("manage"), stem("management"));
    assert.equal(stem("manage"), stem("managing"));
  });

  test("tech names stay whole", () => {
    assert.deepEqual(tokenize("CI/CD with Node.js, C#, C++ and .NET; E-Learning."), ["ci/cd", "with", "node.js", "c#", "c++", "and", ".net", "e-learning"]);
  });

  const resumeWith = (summary: string): ResumeData => ({ ...qaResume(), summary: textToDoc(summary), skillGroups: [], experience: [] });
  for (const [ad, resume, label] of [
    ["Strong JavaScript skills. JavaScript daily.", "Built tools in JS.", "JavaScript"],
    ["Experience with JS frameworks. JS and more JS.", "Built tools in JavaScript.", "JavaScript"],
    ["Deploy to AWS. AWS Lambda.", "Ran services on Amazon Web Services.", "AWS"],
    ["We use machine learning models.", "Built ML pipelines.", "machine learning"],
  ] as const) {
    test(`“${label}” in the ad matches “${resume}”`, () => {
      const r = run(resumeWith(resume), ad);
      assert.equal(r.byLabel(label)?.matched, true, `keywords: ${r.results.map((x) => `${x.label}:${x.matched}`).join(", ")}`);
    });
  }

  test("plural and -ing forms match: the ad asks for “test plans”, the resume says “test planning”", () => {
    const r = run(resumeWith("Responsible for test planning."), "Write test plans. Review test plans weekly.");
    assert.equal(r.results.find((x) => /test plan/i.test(x.label))?.matched, true);
  });
});

describe("the user stays in control of the keyword list", () => {
  test("removed keywords disappear; added ones are matched like the others", () => {
    const before = run(qaResume(), QA_JOB_DESCRIPTION);
    const jmeter = before.results.find((k) => k.label === "JMeter")!;
    const after = run(qaResume(), QA_JOB_DESCRIPTION, { removed: [jmeter.key], added: ["TestNG", "Kubernetes"] });
    assert.equal(after.byLabel("JMeter"), undefined);
    assert.equal(after.byLabel("TestNG")?.matched, true);
    assert.equal(after.byLabel("TestNG")?.source, "added");
    assert.equal(after.byLabel("Kubernetes")?.matched, false);
  });
});

describe("keyword stuffing", () => {
  test("a keyword used more than 5 times is a warning", () => {
    const data = qaResume();
    data.experience[0].description = bulletsToDoc(Array.from({ length: 6 }, (_, i) => `Wrote Playwright test number ${i + 1}.`));
    const r = run(data, QA_JOB_DESCRIPTION);
    const warning = jobMatchChecks(data, r.results, QA_JOB_DESCRIPTION, "").find((c) => c.id.startsWith("overused"));
    assert.ok(warning, "expected an over-use warning");
    assert.match(warning.message, /“Playwright” appears \d+ times/);
  });
});

describe("job title", () => {
  test("a target title in the headline passes", () => {
    const check = jobMatchChecks(qaResume(), [], "", "Senior QA Automation Engineer").find((c) => c.id === "job-title")!;
    assert.equal(check.status, "pass");
  });

  test("the title is guessed from “Job title: …” or a short first line", () => {
    assert.equal(guessJobTitle("About us\nJob title: Payroll Specialist\nWe pay people."), "Payroll Specialist");
    assert.equal(guessJobTitle("Registered Nurse (ICU)\n\nWe are hiring."), "Registered Nurse (ICU)");
    assert.equal(guessJobTitle("We are a fast-growing company looking for great people to join us."), "");
  });
});

describe("saving the job description with the resume", () => {
  const lib = (): Library => {
    const r = createResume(qaResume());
    return { version: 2, resumes: [r] };
  };

  test("new and older resumes start with an empty ATS state", () => {
    assert.deepEqual(createResume(qaResume()).ats, emptyAtsState());
    assert.deepEqual(normalizeAtsState(undefined), emptyAtsState());
    assert.deepEqual(normalizeAtsState({ jobDescription: 42, removedKeywords: ["a", 3] }), { ...emptyAtsState(), removedKeywords: ["a"] });
  });

  test("the job description and keyword edits survive export and import of a backup", () => {
    const library = lib();
    const id = library.resumes[0].id;
    const updated = updateAtsState(library, id, { jobDescription: QA_JOB_DESCRIPTION, targetTitle: "QA Lead", removedKeywords: ["jmeter"], addedKeywords: ["Kubernetes"] });
    const imported = importBackup({ version: 2, resumes: [] }, JSON.stringify(toBackup(updated)));
    assert.equal(imported.added, 1);
    const ats = imported.library.resumes[0].ats;
    assert.equal(ats.jobDescription, QA_JOB_DESCRIPTION);
    assert.equal(ats.targetTitle, "QA Lead");
    assert.deepEqual(ats.removedKeywords, ["jmeter"]);
    assert.deepEqual(ats.addedKeywords, ["Kubernetes"]);
  });

  test("“Create a copy” copies the job description too", () => {
    const library = lib();
    const id = library.resumes[0].id;
    const withJd = updateAtsState(library, id, { jobDescription: "Test job" });
    assert.equal(duplicateResume(withJd, id).copy?.ats.jobDescription, "Test job");
  });
});
