import { test, expect } from "@playwright/test";
import {
  readPaymentCredentials,
  testCheckoutEnabled,
} from "../../src/lib/payments/config.mjs";
const values = {
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3107",
  PAYMENTS_MODE: "test",
  CATALOG_SOURCE: "supabase",
  CMS_SOURCE: "supabase",
  STRIPE_SECRET_KEY: "sk_test_SEEN_LOCAL_FIXTURE_ONLY",
  SUPABASE_SECRET_KEY: "sb_secret_SEEN_LOCAL_FIXTURE_ONLY",
  STRIPE_WEBHOOK_SECRET: "whsec_SEEN_LOCAL_FIXTURE_ONLY",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3106",
};
test("payment configuration never accepts live keys or incomplete setup", () => {
  expect(testCheckoutEnabled(values)).toBe(true);
  for (const override of [
    { STRIPE_SECRET_KEY: "sk_live_rejected" },
    { STRIPE_WEBHOOK_SECRET: "" },
    { SUPABASE_SECRET_KEY: "" },
    { SUPABASE_SECRET_KEY: "sb_publishable_this_is_not_a_server_secret" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://untrusted.example" },
  ])
    expect(testCheckoutEnabled({ ...values, ...override })).toBe(false);
  for (const override of [
    { PAYMENTS_MODE: "live" },
    { PAYMENTS_MODE: "disabled" },
    { CATALOG_SOURCE: "development" },
    { CMS_SOURCE: "files" },
  ])
    expect(testCheckoutEnabled({ ...values, ...override })).toBe(false);
  expect(
    readPaymentCredentials({ ...values, PAYMENTS_MODE: "disabled" }),
  ).not.toBeNull();
});
test("the isolated Stripe transport cannot use real credentials or a hosted database", () => {
  const fixture = {
    ...values,
    PAYMENTS_FIXTURE_ORIGIN: "http://127.0.0.1:3108",
  };
  expect(testCheckoutEnabled(fixture)).toBe(true);
  for (const override of [
    { STRIPE_SECRET_KEY: "sk_test_other_account_key" },
    { SUPABASE_SECRET_KEY: "sb_secret_another_server_only_value" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { PAYMENTS_FIXTURE_ORIGIN: "https://untrusted.example" },
  ])
    expect(readPaymentCredentials({ ...fixture, ...override })).toBeNull();
});
