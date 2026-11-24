/* Shared steps for the browser tests. */
import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const preview = (page: Page) => page.getByAltText(/Resume preview, page 1/);

/**
 * Waits until the preview has finished re-drawing and shows `pages` pages.
 * The sample is two pages in both templates and a cleared resume is one, so
 * the page count also proves WHICH content the preview shows.
 */
export async function previewSettled(page: Page, pages: number) {
  await expect(page.getByTestId("preview-status")).toHaveText(`Up to date · ${pages} page${pages === 1 ? "" : "s"}`);
}

/**
 * A fingerprint (SHA-256) of the page image the preview shows. Comparing the
 * image file itself, not a screenshot, ignores the preview's fade-in
 * animation and drop shadow, which made screenshot comparisons flaky.
 */
export async function previewFingerprint(page: Page): Promise<string> {
  return preview(page).evaluate(async (img: HTMLImageElement) => {
    const bytes = await (await fetch(img.src)).arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

/** All text of a downloaded PDF. */
export async function pdfText(path: string): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(await readFile(path)) }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
  }
  return text;
}

/** Puts saved resumes in the browser's storage before the app loads (as if saved earlier). */
export async function seedLibrary(page: Page, resumes: unknown[]) {
  await page.addInitScript((library) => {
    localStorage.setItem("resume-builder:library:v2", JSON.stringify(library));
  }, { version: 2, resumes });
}

/** The small confirmation window (our own <dialog>, not the browser's). */
export const confirmDialog = (page: Page) => page.getByRole("dialog");

/** Form fields by their position, e.g. field(page, "experience.0.jobTitle"). */
export const field = (page: Page, name: string) => page.locator(`#field-${name.replace(/\./g, "-")}`);
