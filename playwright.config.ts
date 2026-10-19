import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/storefront",
  testIgnore: ["**/catalog/**", "**/catalog-ui/**", "**/development-ui/**", "**/contact-ui/**", "**/film-ui/**", "**/admin-ui/**"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
    bypassCSP: false,
    // Reuse the system browser on Windows instead of downloading another browser.
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : "chromium"),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    env: { CMS_SOURCE: "files", CATALOG_SOURCE: "preview", RESEND_API_KEY: "", CONTACT_FROM_EMAIL: "", CONTACT_TURNSTILE_SITE_KEY: "", CONTACT_TURNSTILE_SECRET_KEY: "" },
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
