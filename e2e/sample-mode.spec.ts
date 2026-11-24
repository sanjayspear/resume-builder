/*
 * UI tests for "sample mode": new resumes start with the sample, the banner
 * and badge, Clear form (confirmation + Undo), the download warning, and
 * preview-only placeholders. Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { previousSample } from "../src/lib/sampleMode";
import { confirmDialog, field, pdfText, previewSettled, seedLibrary } from "./helpers";

const SAMPLE_NAME = "Maya Fernandes";
const banner = (page: Page) => page.getByTestId("sample-banner");
const fullName = (page: Page) => page.getByLabel("Full name *");

/** Creates a resume from the home page and waits for the sample preview. */
async function createResume(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(fullName(page)).toHaveValue(SAMPLE_NAME);
  await previewSettled(page, 2);
}

/** Checks that every section is empty, with exactly one empty entry in each list. */
async function expectCleared(page: Page) {
  for (const name of ["personal.fullName", "personal.jobTitle", "personal.email", "personal.phone", "personal.linkedin"]) {
    await expect(field(page, name), name).toHaveValue("");
  }
  await expect(field(page, "summary")).toHaveText("");
  await expect(page.getByTestId("experience-card")).toHaveCount(1);
  for (const name of [
    "experience.0.jobTitle",
    "experience.0.company",
    "projects.0.name",
    "education.0.degree",
    "certifications.0.name",
    "skillGroups.0.name",
    "languages.0.name",
    "sidebarSummary",
  ]) {
    await expect(field(page, name), name).toHaveValue("");
  }
  for (const name of ["projects.1.name", "education.1.degree", "certifications.1.name", "skillGroups.1.name", "languages.1.name"]) {
    await expect(field(page, name), `${name} should not exist`).toHaveCount(0);
  }
}

/** A resume saved earlier with the user's own details. */
const ownResume = {
  id: "own",
  customName: "",
  createdAt: 1,
  updatedAt: 1,
  data: {
    personal: { fullName: "Priya Raman", jobTitle: "Senior Software Engineer", location: "", phone: "", email: "priya@example.org", website: "", linkedin: "" },
    summary: "QA-minded engineer who builds reliable test automation.",
    experience: [],
    education: [],
    skillGroups: [{ name: "Test Automation", rating: 8, skills: [{ value: "Playwright" }] }],
    languages: [],
    sidebarSummary: "",
    style: { template: "modern-ats" },
  },
};

/* 1 */
for (const [id, name] of [
  ["classic", "Classic Sidebar"],
  ["modern-ats", "Modern ATS"],
] as const) {
  test(`new resume with ${name}: form and preview show the sample; the card has a Sample badge`, async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: `Use ${name} template` }).click();
    await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeChecked();
    await expect(fullName(page)).toHaveValue(SAMPLE_NAME);
    await expect(field(page, "experience.0.company")).toHaveValue("Quillmere Logistics");
    await expect(banner(page)).toContainText("You're looking at sample data. Clear it to start entering your own details. Sample details are fictional.");
    await previewSettled(page, 2);

    await page.getByRole("link", { name: "Back to My resumes" }).click();
    const card = page.getByTestId("resume-card");
    await expect(card.getByTestId("sample-badge")).toHaveText("Sample");
    await expect(card.getByTestId("resume-card-template")).toHaveText(name);
    expect(id).toBeTruthy();
  });
}

/* 2 */
test('"Clear sample data" empties every field without asking; the badge goes away', async ({ page }) => {
  await createResume(page);
  await banner(page).getByRole("button", { name: "Clear sample data" }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await expectCleared(page);
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Form cleared" })).toBeVisible();
  // Template and colour are kept.
  await expect(page.getByRole("radio", { name: /Classic Sidebar/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Coral accent colour" })).toHaveAttribute("aria-pressed", "true");
  await previewSettled(page, 1);

  await page.getByRole("link", { name: "Back to My resumes" }).click();
  await expect(page.getByTestId("resume-card")).toHaveCount(1);
  await expect(page.getByTestId("sample-badge")).toHaveCount(0);
});

/* 3 */
test("own data: Clear form asks first; Cancel keeps it, Clear empties it, Undo brings it back", async ({ page }) => {
  await createResume(page);
  await fullName(page).fill("Priya Raman");
  await expect(banner(page)).toHaveCount(0); // edited: no longer sample mode

  await page.getByRole("button", { name: "Clear form" }).click();
  await expect(confirmDialog(page)).toContainText("Clear all details from this resume? This can't be undone.");
  await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(fullName(page)).toHaveValue("Priya Raman");

  await page.getByRole("button", { name: "Clear form" }).click();
  await confirmDialog(page).getByRole("button", { name: "Clear" }).click();
  await expectCleared(page);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(fullName(page)).toHaveValue("Priya Raman");
  await expect(field(page, "experience.0.company")).toHaveValue("Quillmere Logistics");
  await expect(page.getByTestId("experience-card")).toHaveCount(3);
});

test("the Undo button disappears after about 10 seconds", async ({ page }) => {
  await page.clock.install();
  await createResume(page);
  await banner(page).getByRole("button", { name: "Clear sample data" }).click();
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  await page.clock.fastForward(9_000);
  await expect(undo).toBeVisible();
  await page.clock.fastForward(1_500);
  await expect(undo).toHaveCount(0);
});

/* 4b */
test("a sample saved by the previous version opens with the new fictional details and keeps its Sample badge", async ({ page }) => {
  const old = { id: "old-sample", customName: "", createdAt: 1, updatedAt: 1, data: { ...previousSample(), style: { template: "modern-ats" } } };
  await seedLibrary(page, [old]);
  await page.goto("./");
  await expect(page.getByTestId("resume-card").getByTestId("sample-badge")).toHaveText("Sample");

  await page.goto("./edit?id=old-sample");
  await expect(fullName(page)).toHaveValue(SAMPLE_NAME);
  await expect(field(page, "personal.phone")).toHaveValue("512-555-01XX");
  await expect(field(page, "personal.linkedin")).toHaveValue("linkedin.com/in/your-profile");
  await expect(field(page, "experience.0.company")).toHaveValue("Quillmere Logistics");
  await expect(banner(page)).toBeVisible();
  await previewSettled(page, 2);
});

/* 4 */
test("opening an existing resume shows exactly what was saved (never the sample)", async ({ page }) => {
  const cleared = {
    ...ownResume,
    id: "empty",
    data: { ...ownResume.data, personal: { ...ownResume.data.personal, fullName: "", email: "", jobTitle: "" }, summary: "", skillGroups: [] },
  };
  await seedLibrary(page, [ownResume, cleared]);
  await page.goto("./");
  await expect(page.getByTestId("sample-badge")).toHaveCount(0);

  await page.getByRole("button", { name: /Edit Priya Raman/ }).click();
  await expect(fullName(page)).toHaveValue("Priya Raman");
  await expect(field(page, "personal.jobTitle")).toHaveValue("Senior Software Engineer");
  await expect(field(page, "skillGroups.0.skills.0.value")).toHaveValue("Playwright");
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(fullName(page)).toHaveValue("Priya Raman");

  // An empty saved resume stays empty too.
  await page.goto("./edit?id=empty");
  await expect(fullName(page)).toHaveValue("");
  await expect(banner(page)).toHaveCount(0);
  await previewSettled(page, 1);
  await expect(fullName(page)).toHaveValue("");
});

/* 5 */
test("downloading with sample details warns first, in the editor and on the home page", async ({ page }) => {
  await createResume(page);
  await fullName(page).fill("Priya Raman"); // partly edited: phone, email... are still the sample's

  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(confirmDialog(page)).toContainText("Your resume still contains sample details (email, phone, LinkedIn");
  await expect(confirmDialog(page)).toContainText("Download anyway?");
  await confirmDialog(page).getByRole("button", { name: "Go back and edit" }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  expect(downloads).toBe(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  await confirmDialog(page).getByRole("button", { name: "Download anyway" }).click();
  expect((await download).suggestedFilename()).toBe("Priya-Raman-Resume.pdf");

  // The download button on the home page card warns too.
  await page.getByRole("link", { name: "Back to My resumes" }).click();
  await page.getByRole("button", { name: /Download .* as PDF/ }).click();
  await expect(confirmDialog(page)).toContainText("still contains sample details");
  await confirmDialog(page).getByRole("button", { name: "Go back and edit" }).click();
});

test("own details with a common job title and skill download without a warning", async ({ page }) => {
  await seedLibrary(page, [ownResume]);
  await page.goto("./edit?id=own");
  await expect(fullName(page)).toHaveValue("Priya Raman");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("Priya-Raman-Resume.pdf");
  await expect(confirmDialog(page)).toHaveCount(0);
});

/* 6 */
test("after clearing, the downloaded PDF contains your details and no placeholder text", async ({ page }, testInfo) => {
  await createResume(page);
  await banner(page).getByRole("button", { name: "Clear sample data" }).click();
  await previewSettled(page, 1); // the preview now shows grey hints

  // Fill in only the required fields; the empty entries are skipped.
  await fullName(page).fill("Priya Raman");
  await field(page, "personal.jobTitle").fill("QA Lead");
  await field(page, "personal.email").fill("priya@example.org");
  await field(page, "summary").click();
  await page.keyboard.type("Test lead who ships quality software.");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const file = testInfo.outputPath("cleared.pdf");
  await (await download).saveAs(file);
  const text = await pdfText(file);
  expect(text).toContain("Priya Raman");
  expect(text).toContain("Test lead who ships quality software.");
  for (const hint of ["Your Name", "Job Title", "Your summary appears here", "email@example.com", "Your achievements appear here", "Skill group"]) {
    expect(text, `placeholder "${hint}" in the PDF`).not.toContain(hint);
  }
});

/* Edge cases */
test("refreshing keeps the state: sample stays sample, cleared stays cleared", async ({ page }) => {
  await createResume(page);
  await page.reload();
  await expect(banner(page)).toBeVisible();
  await expect(fullName(page)).toHaveValue(SAMPLE_NAME);

  await banner(page).getByRole("button", { name: "Clear sample data" }).click();
  await expectCleared(page);
  await page.waitForTimeout(800); // auto-save runs 0.4 s after the last change
  await page.reload();
  await expectCleared(page);
  await expect(banner(page)).toHaveCount(0);
});

test('"Load sample data" asks only when the form has your own details', async ({ page }) => {
  await createResume(page);
  await banner(page).getByRole("button", { name: "Clear sample data" }).click();
  await page.getByRole("button", { name: "Load sample data" }).click(); // empty form: no question
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(fullName(page)).toHaveValue(SAMPLE_NAME);

  await fullName(page).fill("Priya Raman");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await expect(confirmDialog(page)).toContainText("Replace your details with the sample resume?");
  await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(fullName(page)).toHaveValue("Priya Raman");
});

test("both templates show the Live preview header without scrolling on a laptop screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await createResume(page);
  for (const id of ["classic", "modern-ats"]) {
    await page.getByTestId(`template-option-${id}`).click();
    const header = page.getByTestId("preview-header");
    await expect(header).toBeInViewport({ ratio: 1 });
    await expect(header.getByRole("link", { name: /Open full size/ })).toBeVisible();
    const box = await header.boundingBox();
    expect(box!.y + box!.height, `${id}: header too low`).toBeLessThan(720 - 100); // room left for the preview
  }
});
