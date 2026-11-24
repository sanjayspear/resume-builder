/*
 * ATS check panel (Phase 1: readability + structure).
 * Run with: npm run test:e2e
 */
import { expect, test, type Page } from "@playwright/test";
import { field } from "./helpers";

const summary = (page: Page) => page.getByTestId("ats-summary");
const panel = (page: Page) => page.getByTestId("ats-panel");

async function openResume(page: Page, template: "Modern ATS" | "Classic Sidebar") {
  await page.goto("/");
  await page.getByRole("button", { name: `Use ${template} template` }).click();
  await expect(field(page, "personal.fullName")).toHaveValue("Maya Fernandes");
}

async function openAtsCheck(page: Page) {
  await page.getByRole("button", { name: "ATS check" }).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.getByText("Up to date · Checked on this device")).toBeVisible();
}

test("Modern ATS passes; Classic Sidebar warns about two columns and can switch", async ({ page }) => {
  await openResume(page, "Modern ATS");
  await openAtsCheck(page);
  await expect(summary(page)).toContainText("Readability: Passed · Structure: Passed · Job match:");
  await expect(panel(page)).toContainText("No tool can predict every company's ATS.");
  await expect(page.getByTestId("ats-check-words")).toHaveAttribute("data-status", "pass");

  await page.getByRole("button", { name: "Close ATS check" }).click();
  await page.getByTestId("template-option-classic").click();
  await openAtsCheck(page);
  await expect(summary(page)).toContainText("Readability: 1 warning - two-column layout · Structure: Passed · Job match:");
  const order = page.getByTestId("ats-check-reading-order");
  await expect(order).toContainText("Two-column layouts can be read out of order by some ATS. Use Modern ATS when applying through job portals.");

  await order.getByRole("button", { name: "Switch to Modern ATS" }).click();
  await expect(summary(page)).toContainText("Readability: Passed · Structure: Passed · Job match:");
  await expect(page.getByRole("radio", { name: /Modern ATS/ })).toBeChecked();
});

test("on desktop the panel starts below the toolbar, so the toolbar stays usable", async ({ page }) => {
  await openResume(page, "Modern ATS");
  await openAtsCheck(page);
  for (const scrolled of [false, true]) {
    if (scrolled) await page.mouse.wheel(0, 1500); // the toolbar sticks to the top while scrolling
    await expect(async () => {
      const toolbar = (await page.locator("#editor-toolbar").boundingBox())!;
      const box = (await panel(page).boundingBox())!;
      expect(Math.abs(box.y - (toolbar.y + toolbar.height)), `panel top vs toolbar bottom (scrolled: ${scrolled})`).toBeLessThanOrEqual(1);
    }).toPass();
    // trial: Playwright checks the buttons could really be clicked (nothing covering them) without clicking.
    for (const name of ["Download PDF", "Clear form", "ATS check"]) {
      await page.getByRole("button", { name, exact: true }).click({ trial: true });
    }
  }
});

test("the checks follow the resume as you edit, and Go to field takes you to the field", async ({ page }) => {
  await openResume(page, "Modern ATS");
  await openAtsCheck(page);
  await expect(summary(page)).toContainText("Readability: Passed · Structure: Passed · Job match:");

  // Remove the LinkedIn link: a warning appears that points at that field.
  await field(page, "personal.linkedin").fill("");
  await expect(summary(page)).toContainText("Readability: Passed · Structure: 1 warning - no LinkedIn · Job match:");
  const linkedin = page.getByTestId("ats-check-linkedin");
  await expect(linkedin).toHaveAttribute("data-status", "warn");
  await expect(linkedin).toContainText("Why it matters:");

  await page.getByTestId("ats-check-order").scrollIntoViewIfNeeded(); // move away first
  await page.mouse.wheel(0, 2000);
  await linkedin.getByRole("button", { name: "Go to field" }).click();
  const input = field(page, "personal.linkedin");
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
  await expect(input).toHaveClass(/ats-highlight/);

  // A job date in a different style is flagged and leads to that date.
  await field(page, "experience.0.startDate").fill("Jan 2024");
  await expect(summary(page)).toContainText("Structure: 2 warnings - no LinkedIn, mixed date styles");
  await page.getByTestId("ats-check-date-style").getByRole("button", { name: "Go to field" }).click();
  await expect(page.locator(":focus")).toHaveAttribute("id", /field-experience-\d-(startDate|endDate)/);
});

test("on a phone the panel fills the screen, and Go to field closes it first", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResume(page, "Modern ATS");
  await field(page, "personal.phone").fill("");
  await openAtsCheck(page);
  const box = await panel(page).boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });

  await page.getByTestId("ats-check-phone").getByRole("button", { name: "Go to field" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(field(page, "personal.phone")).toBeFocused();
  await expect(field(page, "personal.phone")).toBeInViewport();
});

test("privacy: no request contains resume text while the ATS check runs", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (request) => sent.push(`${request.method()} ${request.url()} ${request.postData() ?? ""}`));

  await openResume(page, "Modern ATS");
  // Distinctive text that must never leave the browser.
  await field(page, "personal.fullName").fill("Zanzibar Quokkawell");
  await field(page, "personal.email").fill("zq.private@example.org");
  await openAtsCheck(page);
  await expect(summary(page)).toContainText("Readability:");
  for (const tab of ["Job match", "Content tips", "Readability"]) await page.getByRole("tab", { name: tab }).click();
  await page.getByTestId("template-option-classic").click({ force: true }).catch(() => {});
  await expect(page.getByText("Up to date · Checked on this device")).toBeVisible();

  const leaks = sent.filter((r) => /Zanzibar|Quokkawell|zq\.private|Operations Manager with/i.test(decodeURIComponent(r)));
  expect(leaks, "requests containing resume text").toEqual([]);
  const origins = new Set(sent.map((r) => new URL(r.split(" ")[1]).origin));
  expect([...origins], "only the app's own server is contacted").toEqual([new URL(page.url()).origin]);
});

test("typing stays smooth while the ATS check is open", async ({ page }) => {
  await openResume(page, "Modern ATS");
  await openAtsCheck(page);
  // Record "long tasks" (main thread busy > 50 ms) while typing at a normal pace.
  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[] };
    w.longTasks = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.longTasks.push(e.duration))).observe({ type: "longtask" });
  });
  await field(page, "personal.jobTitle").fill("");
  await field(page, "personal.jobTitle").pressSequentially("Senior Operations and Logistics Manager", { delay: 60 });
  const longest = await page.evaluate(() => Math.max(0, ...(window as unknown as { longTasks: number[] }).longTasks));
  console.log(`longest main-thread task while typing: ${Math.round(longest)} ms`);
  expect(longest, "a keystroke should never wait long").toBeLessThan(200);
});
