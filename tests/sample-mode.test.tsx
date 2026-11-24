/*
 * New resumes start as the sample; "sample mode" detection; Clear form and
 * Undo; completely empty entries; the download warning; preview-only
 * placeholders. Run with: npm test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeResumeData } from "@/lib/library";
import { bulletsToDoc, emptyBulletDoc, textToDoc } from "@/lib/richText";
import { sampleResume } from "@/lib/sampleData";
import {
  clearedContent,
  contentSignature,
  hasNoContent,
  isUntouchedSample,
  newResumeData,
  sampleLeftovers,
} from "@/lib/sampleMode";
import { emptyProject, emptyResume, resumeSchema, type ResumeData } from "@/lib/schema";
import { TEMPLATE_IDS } from "@/lib/templates";
import { PLACEHOLDER_TEXTS } from "@/pdf/placeholders";
import { extractPdf, renderPdf, squash } from "./helpers/pdf";

const sample = () => structuredClone(sampleResume);

/** A resume with someone's own details (not the sample). */
function ownResume(): ResumeData {
  return {
    ...emptyResume(),
    personal: {
      fullName: "Priya Raman",
      jobTitle: "Senior Software Engineer",
      location: "Bengaluru, India",
      phone: "+91 98XXX XXXXX",
      email: "priya@example.org",
      website: "",
      linkedin: "linkedin.com/in/your-name",
    },
    summary: textToDoc("QA-minded engineer who builds reliable test automation."),
    experience: [
      {
        startDate: "May 2021",
        endDate: "",
        isCurrent: true,
        jobTitle: "Senior Software Engineer",
        company: "Zellbrook Test Labs",
        location: "Bengaluru",
        logo: "",
        description: bulletsToDoc(["Built a Playwright suite covering 300 user journeys."]),
      },
    ],
    skillGroups: [{ name: "Test Automation", rating: 9, skills: [{ value: "Playwright" }, { value: "Selenium WebDriver" }] }],
  };
}

describe("new resumes start with the sample", () => {
  for (const template of TEMPLATE_IDS) {
    test(`${template}: a new resume contains the sample content in that template`, () => {
      const data = newResumeData(template);
      assert.equal(data.style.template, template);
      assert.ok(isUntouchedSample(data));
      assert.ok(resumeSchema.safeParse(data).success, "a new resume is valid as it is");
    });
  }

  test("each new resume gets its own copy (editing one never changes the sample)", () => {
    const a = newResumeData("classic");
    a.personal.fullName = "Changed";
    assert.equal(newResumeData("classic").personal.fullName, sampleResume.personal.fullName);
  });

  test("loading a saved resume never fills it with the sample: own data, cleared and empty all stay as saved", () => {
    for (const saved of [ownResume(), clearedContent(sample()), emptyResume()]) {
      const loaded = normalizeResumeData(JSON.parse(JSON.stringify(saved)));
      assert.equal(contentSignature(loaded), contentSignature(saved));
      assert.equal(isUntouchedSample(loaded), false);
    }
  });
});

describe("sample mode detection", () => {
  test("the sample is detected, whatever the design or job order", () => {
    const data = sample();
    data.style = { ...data.style, template: "modern-ats", accentColor: "#123456", fontFamily: "Roboto" };
    data.experienceOrder = "oldest";
    data.experience.reverse();
    assert.ok(isUntouchedSample(data));
  });

  test("small formatting differences from the text editor don't end sample mode", () => {
    const data = sample();
    // The editor may add attributes such as textAlign: "left" to paragraphs.
    data.summary = {
      type: "doc",
      content: data.summary.content.map((block) =>
        block.type === "paragraph" ? { ...block, attrs: { textAlign: "left" } } : block,
      ),
    };
    assert.ok(isUntouchedSample(data));
  });

  test("any edit ends sample mode", () => {
    const edits: ((d: ResumeData) => void)[] = [
      (d) => (d.personal.fullName = "Priya Raman"),
      (d) => (d.personal.phone = "555 0000"),
      (d) => (d.experience[0].description = bulletsToDoc(["Something I did."])),
      (d) => (d.skillGroups[0].rating = 3),
      (d) => (d.languages = []),
      (d) => (d.sidebarSummary = "Mine."),
    ];
    for (const edit of edits) {
      const data = sample();
      edit(data);
      assert.equal(isUntouchedSample(data), false, edit.toString());
    }
  });

  test("empty and cleared resumes are not samples, and have no content", () => {
    assert.equal(isUntouchedSample(emptyResume()), false);
    assert.ok(hasNoContent(emptyResume()));
    assert.ok(hasNoContent(clearedContent(sample())));
    assert.equal(hasNoContent(sample()), false);
  });
});

describe("Clear form", () => {
  test("empties every section and leaves one empty entry in each list", () => {
    const cleared = clearedContent(sample());
    assert.deepEqual(Object.values(cleared.personal), ["", "", "", "", "", "", ""]);
    assert.ok(hasNoContent(cleared));
    for (const list of ["experience", "projects", "education", "certifications", "skillGroups", "languages"] as const) {
      assert.equal(cleared[list].length, 1, `${list} should have one empty entry`);
    }
    assert.equal(cleared.sidebarSummary, "");
  });

  test("keeps the template, both accent colours, the other design choices and the job order", () => {
    const before = sample();
    before.style = { ...before.style, template: "modern-ats", accentColor: "#123456", atsAccentColor: "#7A2E3B", fontSize: 10 };
    before.experienceOrder = "oldest";
    const cleared = clearedContent(before);
    assert.deepEqual(cleared.style, before.style);
    assert.equal(cleared.experienceOrder, "oldest");
  });

  test("Undo brings back exactly what was there (the saved copy isn't affected by later edits)", () => {
    const before = ownResume();
    const undo = structuredClone(before); // what the editor keeps for Undo
    const cleared = clearedContent(before);
    cleared.personal.fullName = "typed after clearing";
    assert.deepEqual(undo, before);
    assert.equal(contentSignature(undo), contentSignature(ownResume()));
  });

  test("the empty entries left by Clear don't cause validation messages", () => {
    const result = resumeSchema.safeParse(clearedContent(sample()));
    assert.equal(result.success, false, "name, email etc. are still required");
    const listIssues = result.error!.issues.filter((issue) =>
      ["experience", "projects", "education", "certifications", "skillGroups", "languages"].includes(String(issue.path[0])),
    );
    assert.deepEqual(listIssues, [], "completely empty entries must be skipped");
  });
});

describe("completely empty vs partly filled entries", () => {
  const withProject = (project: ResumeData["projects"][number]) => ({ ...ownResume(), projects: [project] });

  test("a completely empty project is skipped", () => {
    assert.ok(resumeSchema.safeParse(withProject(emptyProject())).success);
  });

  test("a project with a name but no description shows a message on the description", () => {
    const result = resumeSchema.safeParse(withProject({ name: "My tool", link: "", description: emptyBulletDoc() }));
    assert.equal(result.success, false);
    assert.deepEqual(
      result.error!.issues.map((i) => i.path.join(".")),
      ["projects.0.description"],
    );
  });

  test("a job with only a company shows messages for its missing fields", () => {
    const data = clearedContent(sample());
    Object.assign(data, { personal: ownResume().personal, summary: ownResume().summary });
    data.experience[0].company = "Zellbrook Test Labs";
    const paths = resumeSchema.safeParse(data).error!.issues.map((i) => i.path.join("."));
    assert.ok(paths.includes("experience.0.startDate"), paths.join(", "));
    assert.ok(paths.includes("experience.0.jobTitle"), paths.join(", "));
  });
});

describe("download warning: sample details left behind", () => {
  test("the untouched sample is flagged for name, email, phone, LinkedIn, company and sentences", () => {
    assert.deepEqual(sampleLeftovers(sample()), ["name", "email", "phone", "LinkedIn", "company", "example sentences"]);
  });

  test("own details with common job titles and skills are NOT flagged", () => {
    // Job title "Senior Software Engineer" and skill "Playwright" are common: never a reason to warn.
    const data = ownResume();
    assert.deepEqual(sampleLeftovers(data), []);
    // Things real people share with the sample: city, school, certifications, skills, job titles.
    data.personal.location = sampleResume.personal.location;
    data.education = structuredClone(sampleResume.education);
    data.certifications = structuredClone(sampleResume.certifications);
    data.skillGroups.push(structuredClone(sampleResume.skillGroups[0]));
    data.experience[0].jobTitle = sampleResume.experience[0].jobTitle;
    assert.deepEqual(sampleLeftovers(data), []);
  });

  test("a partly edited sample still warns about what's left (name changed, phone not)", () => {
    const data = sample();
    data.personal.fullName = "Priya Raman";
    data.personal.email = "priya@example.org";
    assert.equal(isUntouchedSample(data), false, "no longer in sample mode");
    const left = sampleLeftovers(data);
    assert.ok(left.includes("phone") && !left.includes("name") && !left.includes("email"), left.join(", "));
  });

  test("the sample phone is recognised however it's written", () => {
    const data = ownResume();
    data.personal.phone = "(512) 555 0147";
    assert.deepEqual(sampleLeftovers(data), ["phone"]);
  });

  test("one sample sentence pasted into your own text is flagged", () => {
    const data = ownResume();
    data.experience[0].description = bulletsToDoc([
      "Built a Playwright suite.",
      "Built a weekly demand forecast with the sales team that reduced emergency freight spend by 22%.",
    ]);
    assert.deepEqual(sampleLeftovers(data), ["example sentences"]);
  });
});

describe("placeholders: preview only, never in a downloaded PDF", () => {
  for (const template of TEMPLATE_IDS) {
    test(`${template}: a cleared resume shows hints in the preview and none in the download`, async () => {
      const cleared = clearedContent({ ...sample(), style: { ...sample().style, template } });
      const preview = squash((await extractPdf(await renderPdf(cleared, { placeholders: true }))).streamText);
      for (const hint of ["Your Name", "Job Title", "Your summary appears here"]) {
        assert.ok(preview.includes(hint), `preview should show "${hint}"`);
      }
      const download = squash((await extractPdf(await renderPdf(cleared))).streamText);
      for (const hint of PLACEHOLDER_TEXTS) assert.ok(!download.includes(hint), `download contains "${hint}"`);
    });

    test(`${template}: a real resume never contains hint text, even in the preview`, async () => {
      const data = { ...sample(), style: { ...sample().style, template } };
      const preview = squash((await extractPdf(await renderPdf(data, { placeholders: true }))).streamText);
      for (const hint of PLACEHOLDER_TEXTS) assert.ok(!preview.includes(hint), `found "${hint}"`);
    });
  }
});
