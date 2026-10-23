import { defineConfig } from "@playwright/test";
import live from "./playwright.live-payments-ui.config";
const servers = Array.isArray(live.webServer) ? live.webServer : [live.webServer!];
export default defineConfig({ ...live, testDir: "./tests/shipping-ui", outputDir: "test-results/shipping-ui",
  webServer: [servers[0], { ...servers[1], env: { ...(servers[1].env as Record<string,string>), ROYAL_MAIL_API_KEY: "ROYAL_MAIL_LOCAL_FIXTURE_ONLY" } }],
});
