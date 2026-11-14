import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against the production build (`npm run build` first).
 * Locally they use the installed Microsoft Edge (no browser download); in CI set
 * PLAYWRIGHT_CHANNEL or install Playwright's Chromium.
 */
const PORT = Number(process.env.PORT ?? 3123);
const BASE_URL = `http://localhost:${PORT}`;
const channel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : "msedge");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  // Allow for many parallel workers sharing one local production server.
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    channel,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    // HTTP-level routing/SEO checks are viewport-independent, so they run on desktop only.
    {
      name: "tablet",
      testIgnore: /routing\.spec\.ts/,
      use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
    },
    {
      name: "mobile",
      testIgnore: /routing\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
