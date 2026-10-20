import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/admin-ui",
  outputDir: "test-results/admin-ui",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3107",
    channel: process.platform === "win32" ? "msedge" : "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node scripts/admin-fixture.mjs",
      url: "http://127.0.0.1:3106/__test/reset",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3107",
      url: "http://127.0.0.1:3107/admin/login",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3107",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3106",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_publishable_admin_test_fixture_key_123456789",
        CMS_SOURCE: "supabase",
        CATALOG_SOURCE: "supabase",
        SITE_INDEXING_ENABLED: "false",
        RESEND_API_KEY: "",
        CONTACT_FROM_EMAIL: "",
        CONTACT_TURNSTILE_SITE_KEY: "",
        CONTACT_TURNSTILE_SECRET_KEY: "",
        CONTACT_INBOX_ENABLED: "false",
        SUPABASE_SECRET_KEY: "",
        PAYMENTS_MODE: "disabled",
        STRIPE_SECRET_KEY: "",
        STRIPE_WEBHOOK_SECRET: "",
        PAYMENTS_FIXTURE_ORIGIN: "",
      },
    },
  ],
});
