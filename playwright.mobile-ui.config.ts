import { defineConfig, devices } from "@playwright/test";
import admin from "./playwright.admin-ui.config";

export default defineConfig({
  ...admin,
  testDir: "./tests/mobile-ui",
  timeout: 45000,
  outputDir: "test-results/mobile-ui",
  use: {
    ...admin.use,
    ...devices["Pixel 5"],
    channel: process.platform === "win32" ? "msedge" : "chromium",
  },
});
