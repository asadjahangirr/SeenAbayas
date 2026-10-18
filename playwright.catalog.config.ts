import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/catalog",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 30_000,
  reporter: "list",
});
