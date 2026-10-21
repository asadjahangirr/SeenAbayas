import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { isolatedEnvironment } from "./scripts/test-environment.mjs";

export default defineConfig({
  ...base,
  testDir: "./tests/development-ui",
  outputDir: "test-results/development-ui",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:3103" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3103",
    url: "http://127.0.0.1:3103",
    reuseExistingServer: false,
    timeout: 120_000,
    env: isolatedEnvironment(3103, { CATALOG_SOURCE: "development" }),
  },
});
