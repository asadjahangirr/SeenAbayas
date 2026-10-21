import { defineConfig, devices } from "@playwright/test";
import { isolatedEnvironment } from "./scripts/test-environment.mjs";

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/storefront",
  testIgnore: ["**/catalog/**", "**/catalog-ui/**", "**/development-ui/**", "**/contact-ui/**", "**/inbox-ui/**", "**/film-ui/**", "**/admin-ui/**", "**/mobile-ui/**", "**/checkout-ui/**", "**/payments-ui/**", "**/live-payments-ui/**"],
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
    env: isolatedEnvironment(3100),
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
