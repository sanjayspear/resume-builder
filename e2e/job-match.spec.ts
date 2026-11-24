/*
 * ATS check, Phase 2: Job match in the browser.
 * Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { OPS_JOB_DESCRIPTION } from "../tests/fixtures/jobDescriptions";
import { field } from "./helpers";

const keyword = (page: Page, list: "matched" | "missing", label: string) =>
  page.getByTestId(`${list}-keywords`).locator(`[data-keyword="${label}"]`);

async function openJobMatch(page: Page) {
  await page.getByRole("button", { name: "ATS check", exact: true }).click();
  await page.getByRole("tab", { name: "Job match" }).click();
}

test("paste a job description, edit the keyword list, and everything is still there after a refresh", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await expect(field(page, "personal.fullName")).toHaveValue("Maya Fernandes");
  await openJobMatch(page);

  // Empty state explains what to do.
  await expect(page.getByTestId("job-match-empty")).toContainText("Paste a job description to see which important keywords your resume already includes.");
  await expect(page.getByTestId("ats-summary")).toContainText("Job match: no job description yet");

  await page.getByLabel("Target job title (optional)").fill("Warehouse Operations Manager");
  await page.getByLabel("Paste job description").fill(OPS_JOB_DESCRIPTION);
  await expect(page.getByTestId("keyword-score")).toHaveText(/Keyword match: \d+ of \d+/);
  await expect(page.getByTestId("ats-summary")).toContainText(/Job match: \d+ of \d+ keywords/);
  await expect(keyword(page, "matched", "inventory management")).toContainText("Found in: Skills");
  await expect(keyword(page, "missing", "Six Sigma")).toBeVisible();
  await expect(page.getByText("Only add skills you really have.")).toBeVisible();

  // Remove an irrelevant keyword and add one of my own.
  await page.getByRole("button", { name: "Remove keyword Six Sigma" }).click();
  await expect(keyword(page, "missing", "Six Sigma")).toHaveCount(0);
  await page.getByLabel("Add a keyword").fill("Forklift certification");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(keyword(page, "missing", "Forklift certification")).toContainText("added by you");
  const score = await page.getByTestId("keyword-score").textContent();

  // Refresh: job description, title and keyword edits are all kept.
  await page.waitForTimeout(800);
  await page.reload();
  await openJobMatch(page);
  await expect(page.getByLabel("Paste job description")).toHaveValue(OPS_JOB_DESCRIPTION);
  await expect(page.getByLabel("Target job title (optional)")).toHaveValue("Warehouse Operations Manager");
  await expect(keyword(page, "missing", "Six Sigma")).toHaveCount(0);
  await expect(keyword(page, "missing", "Forklift certification")).toBeVisible();
  await expect(page.getByTestId("keyword-score")).toHaveText(score!);

  // Removed keywords can be brought back; Clear empties the job description.
  await page.getByRole("button", { name: /Restore 1 removed keyword/ }).click();
  await expect(keyword(page, "missing", "Six Sigma")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByTestId("job-match-empty")).toBeVisible();
  await page.waitForTimeout(800);
  await page.reload();
  await openJobMatch(page);
  await expect(page.getByLabel("Paste job description")).toHaveValue("");
});

test("the job title warning leads to the headline field", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await openJobMatch(page);
  await page.getByLabel("Paste job description").fill(OPS_JOB_DESCRIPTION);
  const title = page.getByTestId("ats-check-job-title");
  await expect(title).toContainText("Warehouse Operations Manager");
  await title.getByRole("button", { name: "Go to field" }).click();
  await expect(field(page, "personal.jobTitle")).toBeFocused();
  await expect(field(page, "personal.jobTitle")).toBeInViewport();
});

test("privacy: the job description is never sent anywhere", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
  await page.goto("./");
  await page.getByRole("button", { name: "Use Modern ATS template" }).click();
  await openJobMatch(page);
  await page.getByLabel("Target job title (optional)").fill("Chief Zorblax Officer");
  await page.getByLabel("Paste job description").fill("Chief Zorblax Officer\nCalibrate zorblax widgets. Zorblax widgets daily. Quantum zorblax tuning.");
  await expect(page.getByTestId("keyword-score")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.reload();
  await openJobMatch(page);
  await expect(page.getByLabel("Paste job description")).toHaveValue(/zorblax/i);
  expect(sent.filter((r) => /zorblax/i.test(decodeURIComponent(r)))).toEqual([]);
});
