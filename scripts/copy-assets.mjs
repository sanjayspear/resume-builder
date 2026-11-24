/*
 * Runs after `npm install` (the "postinstall" script): copies files the
 * browser needs from node_modules into public/, so the app serves them
 * itself (nothing is loaded from other websites):
 *   - the pdf.js worker (live preview, ATS check)
 *   - the English spelling dictionaries, US and UK, with their licence (ATS check)
 * These copies are generated, so they're git-ignored.
 */
import { copyFileSync, mkdirSync } from "node:fs";

copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");

mkdirSync("public/dictionaries", { recursive: true });
for (const [pkg, name] of [
  ["dictionary-en", "en-US"],
  ["dictionary-en-gb", "en-GB"],
]) {
  for (const ext of ["aff", "dic"]) copyFileSync(`node_modules/${pkg}/index.${ext}`, `public/dictionaries/${name}.${ext}`);
  // The dictionaries' licence must travel with them (it's served alongside on the live site).
  copyFileSync(`node_modules/${pkg}/license`, `public/dictionaries/${name}.LICENSE.txt`);
}
