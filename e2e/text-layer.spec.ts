/*
 * The bug that scrambled the PDF text ("REST" -> "&EST") only happened in the
 * browser, after the live preview had rendered earlier versions of the
 * resume. This test does exactly that, then checks the downloaded file.
 * Run with: npm run test:e2e
 */
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { toUnicodeProblems } from "../tests/helpers/pdfBytes";
import { field, pdfText, previewSettled } from "./helpers";

const FINAL =
  "Validated REST APIs with TestNG on Azure for Fabrikam’s internal WAF (Web Automation Framework), " +
  "ensuring cross-browser E-Learning quality since 2017: R&D, CI/CD | QA@example.net.";

for (const template of ["modern-ats", "classic"] as const) {
  test(`${template}: downloaded PDF text is exact after the preview rendered other versions`, async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create resume" }).click();
    await page.getByTestId(`template-option-${template}`).click();
    await page.getByTestId("sample-banner").getByRole("button", { name: "Clear sample data" }).click();
    await field(page, "personal.fullName").fill("Text Layer");
    await field(page, "personal.jobTitle").fill("QA Engineer");
    await field(page, "personal.email").fill("qa@example.org");

    // 1. A first version with a straight apostrophe; let the preview render it.
    await field(page, "summary").click();
    await page.keyboard.type("Fabrikam's team, first draft.");
    await previewSettled(page, 1);

    // 2. Replace it with the final text (curly apostrophe and every tricky character), then download.
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(FINAL);
    await previewSettled(page, 1);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const file = testInfo.outputPath("text-layer.pdf");
    await (await download).saveAs(file);

    expect(toUnicodeProblems(await readFile(file)), "glyph-to-letter map").toEqual([]);
    expect((await pdfText(file)).replace(/\s+/g, " ")).toContain(FINAL);
  });
}
