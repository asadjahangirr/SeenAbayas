import { defineConfig } from "@playwright/test";
import admin from "./playwright.admin-ui.config";
export default defineConfig({
  ...admin,
  testDir: "./tests/payments-ui",
  outputDir: "test-results/payments-ui",
  timeout: 60000,
  webServer: [
    {
      command: "node scripts/payments-fixture.mjs",
      url: "http://127.0.0.1:3108/__test/state",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3107",
      url: "http://127.0.0.1:3107/checkout",
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
        PAYMENTS_MODE: "test",
        STRIPE_SECRET_KEY: "sk_test_SEEN_LOCAL_FIXTURE_ONLY",
        STRIPE_WEBHOOK_SECRET: "whsec_SEEN_LOCAL_FIXTURE_ONLY",
        PAYMENTS_RECONCILE_SECRET: "seen-local-fixture-recovery-token-only-123456",
        SUPABASE_SECRET_KEY: "sb_secret_SEEN_LOCAL_FIXTURE_ONLY",
        PAYMENTS_FIXTURE_ORIGIN: "http://127.0.0.1:3108",
        CONTACT_INBOX_ENABLED: "false",
        RESEND_API_KEY: "",
        CONTACT_FROM_EMAIL: "",
        CONTACT_TURNSTILE_SITE_KEY: "",
        CONTACT_TURNSTILE_SECRET_KEY: "",
      },
    },
  ],
});
