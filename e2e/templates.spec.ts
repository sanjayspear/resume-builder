/*
 * UI test: create a resume, switch between Classic Sidebar and Modern ATS,
 * check the preview follows, download the PDF and check the file.
 * Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, pdfText, preview, previewFingerprint, previewSettled, seedLibrary } from "./helpers";

/** Clicks a template card and waits for the preview to show the new design. */
async function switchTemplate(page: Page, id: "classic" | "modern-ats", name: string) {
  const before = await preview(page).getAttribute("src");
  await page.getByTestId(`template-option-${id}`).click();
  await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeChecked();
  await expect(page.getByTestId("current-template")).toContainText(`${name} template`);
  await expect(preview(page)).not.toHaveAttribute("src", before ?? "");
  await previewSettled(page, 2);
}

test("switch between both templates without losing data, then download the PDF", async ({ page }, testInfo) => {
  // Create a resume: it starts with the sample data.
  await page.goto("./");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page).toHaveURL(/\/edit\/?\?id=/); // "/edit/?id=" on the static site
  await expect(page.getByLabel("Full name *")).toHaveValue("Maya Fernandes");
  await previewSettled(page, 2);

  // New resumes start on Classic Sidebar; both template cards are offered.
  await expect(page.getByRole("radio", { name: /Classic Sidebar/ })).toBeChecked();
  await expect(page.getByTestId("template-option-modern-ats")).toContainText("Best for job portals");
  const classicPreview = await previewFingerprint(page);

  // Switch to Modern ATS: the preview changes and Classic-only options disappear.
  await switchTemplate(page, "modern-ats", "Modern ATS");
  expect(await previewFingerprint(page), "preview should show a different design").not.toBe(classicPreview);
  await expect(page.getByLabel("Font")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Burgundy accent colour" })).toBeVisible();

  // Switch back: the content is untouched and the Classic preview returns.
  await switchTemplate(page, "classic", "Classic Sidebar");
  await expect(page.getByLabel("Full name *")).toHaveValue("Maya Fernandes");
  await expect(page.getByTestId("experience-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /More options/ })).toBeVisible();
  expect(await previewFingerprint(page), "Classic preview should be restored").toBe(classicPreview);

  // Download with Modern ATS selected: the file name, and the PDF is the ATS design.
  await switchTemplate(page, "modern-ats", "Modern ATS");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  // Still the sample, so the app warns first.
  await confirmDialog(page).getByRole("button", { name: "Download anyway" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Maya-Fernandes-Resume.pdf");
  const file = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  const text = await pdfText(file);
  expect(text).toContain("WORK EXPERIENCE");
  expect(text).toContain("CERTIFICATIONS");
  expect(text).toContain("Software");
  expect(text).toContain("efficiency");
  expect(text).toContain("affiliated");
  // Modern ATS leaves out the sidebar summary; Classic Sidebar shows it.
  expect(text).not.toContain("Hands-on operations leader");

  // The home page card shows which template this resume uses.
  await page.getByRole("link", { name: "Back to My resumes" }).click();
  await expect(page.getByTestId("resume-card-template")).toHaveText("Modern ATS");
});

test("resumes saved by the previous version open with the right template", async ({ page }) => {
  // Saved before this change: old template ids, no new fields.
  const old = (id: string, fullName: string, template: string) => ({
    id,
    customName: "",
    createdAt: 1,
    updatedAt: 1,
    data: {
      personal: { fullName, jobTitle: "Tester", location: "", phone: "", email: "a@example.com", website: "" },
      summary: "Plain-text summary from an old save.",
      experience: [],
      education: [],
      skillGroups: [],
      sidebarSummary: "",
      style: { template, fontFamily: "SourceSans3", fontSize: 8.8, lineHeight: 1.32, accentColor: "#3D4552", logoSize: 24 },
    },
  });
  await seedLibrary(page, [old("a", "Old Slate", "slate"), old("b", "Old Minimal", "minimal"), old("c", "No Template", "")]);

  await page.goto("./");
  const card = (name: string) => page.getByRole("article", { name: new RegExp(name) }).getByTestId("resume-card-template");
  await expect(card("Old Slate")).toHaveText("Classic Sidebar");
  await expect(card("Old Minimal")).toHaveText("Modern ATS");
  await expect(card("No Template")).toHaveText("Classic Sidebar");

  // Opening one works and shows the template in the editor.
  await page.getByRole("button", { name: /Edit Old Slate/ }).click();
  await expect(page.getByTestId("current-template")).toContainText("Classic Sidebar template");
  await expect(page.getByLabel("Full name *")).toHaveValue("Old Slate");
  await expect(page.getByTestId("sample-banner")).toHaveCount(0);
  await previewSettled(page, 1);
});
