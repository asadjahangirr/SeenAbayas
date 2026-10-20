import { defineConfig } from "@playwright/test";
import admin from "./playwright.admin-ui.config";

export default defineConfig({
  ...admin,
  testDir: "./tests/checkout-ui",
  timeout: 45000,
  outputDir: "test-results/checkout-ui",
});
