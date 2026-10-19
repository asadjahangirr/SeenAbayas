import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/contact-ui",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:3104" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3104",
    url: "http://127.0.0.1:3104",
    reuseExistingServer: false,
    timeout: 120_000,
    // Synthetic, invalid provider credentials. Browser fixtures intercept widget
    // and contact requests; no real email or verification service is used.
    env: { CMS_SOURCE: "files", CATALOG_SOURCE: "preview", SITE_INDEXING_ENABLED: "false", RESEND_API_KEY: "re_test_key_never_sent", CONTACT_FROM_EMAIL: "contact@example.invalid", CONTACT_TURNSTILE_SITE_KEY: "test_public_site_key_123", CONTACT_TURNSTILE_SECRET_KEY: "test_secret_never_sent" },
  },
});
