import { defineConfig } from "@playwright/test";
import payments from "./playwright.payments-ui.config";
const servers = Array.isArray(payments.webServer) ? payments.webServer : [payments.webServer!];
export default defineConfig({
  ...payments,
  testDir: "./tests/live-payments-ui",
  outputDir: "test-results/live-payments-ui",
  webServer: [servers[0], {...servers[1], env:{
    ...(servers[1].env as Record<string,string>),
    PAYMENTS_MODE:"live",PAYMENTS_TAX_MODE:"none",
    STRIPE_SECRET_KEY:"sk_live_SEEN_LOCAL_FIXTURE_ONLY",
    STRIPE_WEBHOOK_SECRET:"whsec_SEEN_LOCAL_LIVE_FIXTURE_ONLY",
    STRIPE_TEST_SECRET_KEY:"sk_test_SEEN_LOCAL_FIXTURE_ONLY",
    STRIPE_TEST_WEBHOOK_SECRET:"whsec_SEEN_LOCAL_FIXTURE_ONLY",
  }}],
});
