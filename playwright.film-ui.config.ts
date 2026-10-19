import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/film-ui",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:3105" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3105",
    url: "http://127.0.0.1:3105",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CMS_SOURCE: "files", CATALOG_SOURCE: "development", SITE_INDEXING_ENABLED: "false", 
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      RESEND_API_KEY: "", CONTACT_FROM_EMAIL: "", CONTACT_TURNSTILE_SITE_KEY: "", CONTACT_TURNSTILE_SECRET_KEY: "",
    },
  },
});
