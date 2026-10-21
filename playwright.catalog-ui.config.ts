import { defineConfig, devices } from "@playwright/test";
import { isolatedEnvironment } from "./scripts/test-environment.mjs";

export default defineConfig({
  testDir: "./tests/catalog-ui",
  outputDir: "test-results/catalog-ui",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3102",
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : "chromium"),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    { command: "node tests/fixtures/catalog-api.mjs", url: "http://127.0.0.1:3101/health", reuseExistingServer: false },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102",
      reuseExistingServer: false,
      env: isolatedEnvironment(3102, {
        CATALOG_SOURCE: "supabase",
        CMS_SOURCE: "files",

        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3101",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_TEST_ONLY",
      }),
    },
  ],
});
