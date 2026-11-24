/*
 * Spell check in Content tips: real dictionaries, run on the device.
 * Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { field } from "./helpers";

const tip = (page: Page, word: string) => page.getByTestId("tip").filter({ hasText: `“${word}”` });

async function openTips(page: Page) {
  await page.getByRole("button", { name: "ATS check", exact: true }).click();
  await page.getByRole("tab", { name: "Content tips" }).click();
  await expect(page.getByTestId("spelling-status")).toContainText("Spelling is checked on this device");
}

test("misspelled words get suggestions; Ignore word is remembered; dictionaries come from this site", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("./");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await openTips(page);
  // The sample is spelled correctly.
  await expect(page.getByRole("region", { name: "Spelling" })).toHaveCount(0);

  await field(page, "summary").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Operations manager. We recieved great feedbak on the 2024 programme and the new program.");

  await expect(tip(page, "recieved")).toContainText("Did you mean “received”");
  await expect(tip(page, "feedbak")).toContainText("Did you mean “feedback”");
  await expect(page.getByRole("region", { name: "Spelling" })).toContainText("Spelling (2)"); // programme and program are both fine

  // Go to field: the summary.
  await tip(page, "recieved").getByRole("button", { name: "Go to field" }).click();
  await expect(field(page, "summary")).toBeFocused();

  // Ignore word: gone, and still ignored after a refresh.
  await page.getByRole("button", { name: "Ignore word “feedbak”" }).click();
  await expect(tip(page, "feedbak")).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.reload();
  await openTips(page);
  await expect(tip(page, "recieved")).toBeVisible();
  await expect(tip(page, "feedbak")).toHaveCount(0);

  // The dictionaries were loaded from this site only.
  const origin = new URL(page.url()).origin;
  const dictionaries = requests.filter((u) => u.includes("/dictionaries/"));
  expect(dictionaries.length).toBeGreaterThanOrEqual(4);
  for (const url of dictionaries) expect(new URL(url).origin).toBe(origin);
});
