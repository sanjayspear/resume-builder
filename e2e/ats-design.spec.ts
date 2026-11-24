/*
 * Modern ATS design options in the editor: header style, accent colour and
 * "Bold numbers". Each change must update the preview; the downloaded PDF
 * keeps the same text in the same order. Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { toUnicodeProblems } from "../tests/helpers/pdfBytes";
import { confirmDialog, pdfText, preview, previewFingerprint, previewSettled } from "./helpers";

/** Makes a change and waits until the preview shows a NEW picture; returns its fingerprint. */
async function changeAndWait(page: Page, change: () => Promise<void>) {
  const before = await preview(page).getAttribute("src");
  await change();
  await expect(preview(page)).not.toHaveAttribute("src", before ?? "");
  await previewSettled(page, 2);
  return previewFingerprint(page);
}

test("header styles, colours and Bold numbers update the preview; the PDF keeps its text", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await previewSettled(page, 2);

  // New resumes start with the Banner header; the options are offered as thumbnails.
  const header = (name: string) => page.getByRole("radio", { name: new RegExp(name) });
  await expect(header("Banner")).toBeChecked();
  await expect(page.getByTestId("header-option-accent")).toContainText("Left accent");
  const seen = new Set([await previewFingerprint(page)]);

  for (const [id, name] of [["accent", "Left accent"], ["minimal", "Minimal"], ["banner", "Banner"]] as const) {
    const print = await changeAndWait(page, () => page.getByTestId(`header-option-${id}`).click());
    await expect(header(name)).toBeChecked();
    if (id !== "banner") expect(seen.has(print), `${name} should look different`).toBe(false);
    seen.add(print);
  }

  // Each new colour changes the preview.
  for (const colour of ["Amber", "Royal blue", "Emerald", "Plum"]) {
    const button = page.getByRole("button", { name: `${colour} accent colour` });
    const print = await changeAndWait(page, () => button.click());
    await expect(button).toHaveAttribute("aria-pressed", "true");
    expect(seen.has(print), `${colour} should look different`).toBe(false);
    seen.add(print);
  }

  // Bold numbers (under "More options"): on by default; switching it off changes the preview.
  await page.getByRole("button", { name: /More options: bold numbers/ }).click();
  const bold = page.getByRole("checkbox", { name: /Bold numbers/ });
  await expect(bold).toBeChecked();
  await changeAndWait(page, () => bold.uncheck());
  await changeAndWait(page, () => bold.check());

  // The choices are saved with the resume.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(header("Banner")).toBeChecked();
  await expect(page.getByRole("button", { name: "Plum accent colour" })).toHaveAttribute("aria-pressed", "true");

  // Download (still the sample, so confirm the warning) and check the file.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  await confirmDialog(page).getByRole("button", { name: "Download anyway" }).click();
  const file = testInfo.outputPath("modern-ats.pdf");
  await (await download).saveAs(file);
  expect(await toUnicodeProblems(await readFile(file))).toEqual([]);
  const text = (await pdfText(file)).replace(/\s+/g, " ");
  const order = ["Maya Fernandes", "Operations Manager", "maya.fernandes@example.com", "SUMMARY", "SKILLS", "WORK EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "LANGUAGES"];
  let from = 0;
  for (const step of order) {
    const at = text.indexOf(step, from);
    expect(at, `"${step}" in order`).toBeGreaterThanOrEqual(0);
    from = at + step.length;
  }
  for (const metric of ["40%", "$140K", "6,500", "99.4%", "3,000+"]) expect(text).toContain(metric);
});
