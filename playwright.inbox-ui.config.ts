import { defineConfig } from "@playwright/test";
import admin from "./playwright.admin-ui.config";

const servers = Array.isArray(admin.webServer) ? admin.webServer : [admin.webServer!];
export default defineConfig({
  ...admin,
  testDir: "./tests/inbox-ui",
  outputDir: "test-results/inbox-ui",
  webServer: [servers[0], { ...servers[1], env: {
    ...servers[1].env,
    CONTACT_DELIVERY: "inbox",
    SUPABASE_SECRET_KEY: "sb_secret_SEEN_LOCAL_FIXTURE_ONLY",
    CONTACT_TURNSTILE_SITE_KEY: "", CONTACT_TURNSTILE_SECRET_KEY: "",
  } }],
});
