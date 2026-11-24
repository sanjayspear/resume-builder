/*
 * Red wavy underlines in the form, from the app's own spell check (the
 * same one as the ATS check's Spelling tips). Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { field } from "./helpers";

const underlined = (page: Page, name: string) => field(page, name).locator(".spell-error");

async function newResumeWithSummary(page: Page, summary: string) {
  await page.goto("./");
  await page.getByRole("button", { name: "Create resume" }).click();
  await field(page, "summary").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(summary);
}

test("misspelled words in the summary are underlined; click one to fix or ignore it", async ({ page }) => {
  await newResumeWithSummary(page, "Operations manager. We recieved great feedbak on the programme from Quillmere.");

  // Only real mistakes: British spelling (programme) and names (Quillmere) are fine.
  await expect(underlined(page, "summary")).toHaveText(["recieved", "feedbak"]);
  // The browser's own spell check is off, so there's only one set of underlines.
  await expect(field(page, "summary")).toHaveAttribute("spellcheck", "false");

  // Click a word: suggestions, best first.
  await underlined(page, "summary").filter({ hasText: "recieved" }).click();
  const menu = page.getByTestId("spell-menu");
  await expect(menu.getByRole("button").first()).toHaveText("received");
  await menu.getByRole("button", { name: "received", exact: true }).click();
  await expect(field(page, "summary")).toContainText("We received great feedbak");
  await expect(underlined(page, "summary")).toHaveText(["feedbak"]);

  // Ignore a word: no underline, and the ATS check agrees (same list of ignored words).
  await underlined(page, "summary").filter({ hasText: "feedbak" }).click();
  await page.getByTestId("spell-menu").getByRole("button", { name: "Ignore “feedbak”" }).click();
  await expect(underlined(page, "summary")).toHaveCount(0);
  await page.getByRole("button", { name: "ATS check", exact: true }).click();
  await page.getByRole("tab", { name: "Content tips" }).click();
  await expect(page.getByTestId("spelling-status")).toContainText("Spelling is checked on this device");
  await expect(page.getByTestId("tip").filter({ hasText: "“feedbak”" })).toHaveCount(0);

  // Still ignored after a refresh.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(field(page, "summary")).toContainText("feedbak");
  await page.waitForTimeout(1500);
  await expect(underlined(page, "summary")).toHaveCount(0);
});

test("single-line fields: the job title gets an underline and a one-click fix", async ({ page }) => {
  await newResumeWithSummary(page, "Operations manager.");
  const jobTitle = field(page, "personal.jobTitle");
  await jobTitle.fill("Senoir Operations Manager");

  // The underline is drawn on a see-through copy over the field.
  const overlay = jobTitle.locator("xpath=..").locator(".spell-error");
  await expect(overlay).toHaveText("Senoir");
  const hint = page.getByTestId("spell-hint").first();
  await expect(hint).toContainText("Spelling: Senoir");
  await hint.getByRole("button", { name: "Replace Senoir with Senior" }).click();
  await expect(jobTitle).toHaveValue("Senior Operations Manager");
  await expect(overlay).toHaveCount(0);

  // Typing still works normally in the field (the copy ignores the mouse).
  await jobTitle.click();
  await expect(jobTitle).toBeFocused();
  // Put the cursor at the end (the End key doesn't do that in macOS text fields).
  await jobTitle.evaluate((el: HTMLInputElement) => el.setSelectionRange(el.value.length, el.value.length));
  await page.keyboard.type(" II");
  await expect(jobTitle).toHaveValue("Senior Operations Manager II");
});

test("names, emails and other fields have no browser underlines", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Create resume" }).click();
  for (const name of ["personal.fullName", "personal.email", "personal.location", "sidebarSummary"]) {
    await expect(field(page, name)).toHaveAttribute("spellcheck", "false");
  }
});
