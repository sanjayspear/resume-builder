import { defineConfig, devices } from "@playwright/test";

/*
 * Browser (UI) tests in ./e2e.
 *
 *   npm run test:e2e        Builds the app and starts the production server
 *                           on port 3100 (doesn't clash with your own
 *                           `npm run dev`: Next.js allows one dev server per
 *                           project folder).
 *   npm run test:e2e:pages  Builds the GitHub Pages version (static export,
 *                           /resume-builder/ base path, exactly like the
 *                           deploy workflow) and serves it like GitHub Pages
 *                           on port 4173: tests what the live site runs.
 *
 * Tests navigate with relative paths ("./", "./edit?id=…") so they work under
 * both "/" and "/resume-builder/".
 */
const pagesBuild = process.env.E2E_TARGET === "pages";
const PORT = pagesBuild ? 4173 : 3100;
const baseURL = pagesBuild ? `http://localhost:${PORT}/resume-builder/` : `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 }, // the first PDF preview takes a while while fonts load
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: pagesBuild
      ? `npm run build:pages && node scripts/serve-pages.mjs --port ${PORT}`
      : `npx next build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
