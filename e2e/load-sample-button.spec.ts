/*
 * "Load sample data" is unavailable while the form already holds the
 * untouched sample, available otherwise. Its state comes from the content,
 * so it must also be right after a page refresh. Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, field } from "./helpers";

const loadButton = (page: Page) => page.getByRole("button", { name: "Load sample data" });
const tooltip = (page: Page) => page.getByRole("tooltip");

async function expectUnavailable(page: Page) {
  await expect(loadButton(page)).toHaveAttribute("aria-disabled", "true");
  // NOT the plain disabled attribute, so it stays focusable (and can show its tooltip).
  await expect(loadButton(page)).not.toHaveAttribute("disabled");
  await expect(loadButton(page)).toHaveCSS("cursor", "not-allowed");
}

async function expectAvailable(page: Page) {
  await expect(loadButton(page)).not.toHaveAttribute("aria-disabled");
  await expect(loadButton(page)).not.toHaveCSS("cursor", "not-allowed");
}

/** Reloads after auto-save has run (0.4 s after the last change). */
async function reloadAfterSave(page: Page) {
  await page.waitForTimeout(800);
  await page.reload();
  await expect(field(page, "personal.fullName")).toBeVisible();
}

async function newResume(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(field(page, "personal.fullName")).toHaveValue("Maya Fernandes");
}

test("new resume: unavailable, greyed out, explains why on hover and focus, and clicking does nothing", async ({ page }) => {
  await newResume(page);
  await expectUnavailable(page);

  await loadButton(page).hover();
  await expect(tooltip(page)).toHaveText("Sample data is already loaded");
  await expect(loadButton(page)).toHaveAccessibleDescription("Sample data is already loaded");

  await page.mouse.move(0, 0);
  await expect(tooltip(page)).toBeHidden();
  await loadButton(page).focus();
  await expect(loadButton(page)).toBeFocused();
  await expect(tooltip(page)).toBeVisible();

  // Centre the summary: still the untouched sample (only the text counts),
  // but loading the sample again WOULD undo it, so it shows whether the
  // click really did nothing.
  await field(page, "summary").click();
  await page.getByRole("toolbar", { name: "Summary * formatting" }).getByRole("button", { name: "Align center" }).click();
  await expectUnavailable(page);
  // A real mouse click. (Playwright normally refuses to click an aria-disabled
  // button; force makes it click anyway, like a person would.)
  await loadButton(page).click({ force: true });
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(field(page, "summary").locator("p").first()).toHaveCSS("text-align", "center");

  await reloadAfterSave(page);
  await expectUnavailable(page);
});

test("Clear sample data: available; loading the sample makes it unavailable again, with no extra message", async ({ page }) => {
  await newResume(page);
  await page.getByTestId("sample-banner").getByRole("button", { name: "Clear sample data" }).click();
  await expectAvailable(page);
  await reloadAfterSave(page);
  await expectAvailable(page);

  await loadButton(page).click(); // empty form: no question
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(field(page, "personal.fullName")).toHaveValue("Maya Fernandes");
  await expectUnavailable(page);
  // Only the banner says so; no separate "Sample data loaded." message.
  await expect(page.getByTestId("sample-banner")).toBeVisible();
  await expect(page.getByText("Sample data loaded.")).toHaveCount(0);

  await reloadAfterSave(page);
  await expectUnavailable(page);
});

test("editing a field makes it available; clicking it asks before overwriting", async ({ page }) => {
  await newResume(page);
  await field(page, "personal.fullName").fill("Priya Raman");
  await expectAvailable(page);
  await reloadAfterSave(page);
  await expectAvailable(page);

  await loadButton(page).click();
  await expect(confirmDialog(page)).toContainText("Replace your details with the sample resume?");
  await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(field(page, "personal.fullName")).toHaveValue("Priya Raman");
  await expectAvailable(page);
});

test("Clear form then Undo brings the sample back and makes it unavailable again", async ({ page }) => {
  await newResume(page);
  await page.getByRole("button", { name: "Clear form" }).click(); // untouched sample: no question
  await expectAvailable(page);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(field(page, "personal.fullName")).toHaveValue("Maya Fernandes");
  await expectUnavailable(page);

  await reloadAfterSave(page);
  await expectUnavailable(page);
});
