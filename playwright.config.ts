import { defineConfig, devices } from "@playwright/test";

/*
 * Browser (UI) tests in ./e2e. Run with: npm run test:e2e
 * Builds the app and starts the production server on port 3100, so it
 * tests what users get and doesn't clash with your own `npm run dev`
 * (Next.js allows only one dev server per project folder).
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 }, // the first PDF preview takes a while while fonts load
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
