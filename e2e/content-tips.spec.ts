/*
 * ATS check, Phase 3: Content tips in the browser.
 * Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { field } from "./helpers";

const tip = (page: Page, title: string) => page.getByTestId("tip").filter({ hasText: title });

async function openTips(page: Page) {
  await page.getByRole("button", { name: "ATS check", exact: true }).click();
  await page.getByRole("tab", { name: "Content tips" }).click();
}

test("the sample's one tip: Go to field, dismiss it (kept after a refresh), show it again", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await expect(field(page, "personal.fullName")).toHaveValue("Maya Fernandes");
  await openTips(page);

  // The sample is a model example with exactly one tip left.
  const title = "Senior Operations Manager: 1 of 8 bullets without a number";
  await expect(page.getByTestId("ats-summary")).toContainText("Content tips: 1 tip");
  await expect(page.getByTestId("tip")).toHaveCount(1);
  const theTip = tip(page, title);
  await expect(theTip).toContainText("Lead a weekly continuous-improvement meeting");
  await expect(theTip).toContainText("Why it matters:");

  // Go to field: that job's bullets.
  await theTip.getByRole("button", { name: "Go to field" }).click();
  const focused = page.locator(":focus");
  await expect(focused).toHaveAttribute("id", /^field-experience-\d-description$/);
  await expect(focused).toContainText("Lead a weekly continuous-improvement meeting");
  await expect(focused).toBeInViewport();

  // Dismiss: gone, and still gone after a refresh.
  await page.getByRole("button", { name: `Dismiss tip: ${title}` }).click();
  await expect(page.getByTestId("tip")).toHaveCount(0);
  await expect(page.getByTestId("tips-empty")).toBeVisible();
  await expect(page.getByTestId("ats-summary")).toContainText("Content tips: none");
  await page.waitForTimeout(800);
  await page.reload();
  await openTips(page);
  await expect(page.getByTestId("ats-summary")).toContainText("Content tips: none");

  await page.getByRole("button", { name: "Show 1 dismissed tip again" }).click();
  await expect(tip(page, title)).toBeVisible();
});

test("new tips appear as you type: a cliché in the summary and a full home address", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await openTips(page);
  await expect(page.getByTestId("ats-summary")).toContainText("Content tips: 1 tip");

  await field(page, "summary").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Hardworking team player.");
  await expect(tip(page, "“hardworking”")).toBeVisible();
  await expect(tip(page, "“team player”")).toBeVisible();

  await field(page, "personal.location").fill("42 Example Lane, Exampleton");
  await expect(tip(page, "Full home address")).toContainText("City and region are enough");
  await tip(page, "Full home address").getByRole("button", { name: "Go to field" }).click();
  await expect(field(page, "personal.location")).toBeFocused();
});
