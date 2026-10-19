import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/development-ui",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:3103" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3103",
    url: "http://127.0.0.1:3103",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CMS_SOURCE: "files", CATALOG_SOURCE: "development", SITE_INDEXING_ENABLED: "false", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
