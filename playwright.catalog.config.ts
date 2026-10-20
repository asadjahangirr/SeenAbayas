import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/catalog",
  outputDir: "test-results/catalog-db",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 30_000,
  reporter: "list",
});
