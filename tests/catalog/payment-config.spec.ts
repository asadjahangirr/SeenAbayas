import { test, expect } from "@playwright/test";
import {
  readPaymentCredentials,
  testCheckoutEnabled,
  checkoutPaymentMode,
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
test("sandbox checkout rejects live-only credentials and incomplete setup", () => {
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

test("live checkout requires explicit mode, zero added tax, HTTPS and retained separate sandbox credentials", () => {
  const live={...values,NEXT_PUBLIC_SITE_URL:"https://www.seenabayas.co.uk",PAYMENTS_MODE:"live",PAYMENTS_TAX_MODE:"none",STRIPE_SECRET_KEY:"sk_live_fixture_not_real",STRIPE_WEBHOOK_SECRET:"whsec_live_fixture",STRIPE_TEST_SECRET_KEY:values.STRIPE_SECRET_KEY,STRIPE_TEST_WEBHOOK_SECRET:values.STRIPE_WEBHOOK_SECRET};
  expect(checkoutPaymentMode(live)).toBe("live");
  expect(readPaymentCredentials(live,"test")?.stripeKey).toBe(values.STRIPE_SECRET_KEY);
  for(const override of [{PAYMENTS_TAX_MODE:""},{PAYMENTS_MODE:"disabled"},{STRIPE_TEST_SECRET_KEY:""},{STRIPE_TEST_WEBHOOK_SECRET:""},{NEXT_PUBLIC_SITE_URL:"http://localhost:3000"},{STRIPE_WEBHOOK_SECRET:values.STRIPE_WEBHOOK_SECRET}])
    expect(checkoutPaymentMode({...live,...override})).toBeNull();
  expect(checkoutPaymentMode({...live,PAYMENTS_MODE:"test"})).toBe("test");
});

test("restricted live keys retain separate sandbox credentials without crossing checkout environments", () => {
  const staged = {
    ...values,
    NEXT_PUBLIC_SITE_URL: "https://www.seenabayas.co.uk",
    PAYMENTS_TAX_MODE: "none",
    STRIPE_SECRET_KEY: "rk_live_fixture_not_real",
    STRIPE_WEBHOOK_SECRET: "whsec_live_fixture",
    STRIPE_TEST_SECRET_KEY: "rk_test_fixture_not_real",
    STRIPE_TEST_WEBHOOK_SECRET: "whsec_test_fixture",
  };
  expect(checkoutPaymentMode(staged)).toBe("test");
  expect(readPaymentCredentials(staged, "test")).toMatchObject({
    stripeKey: staged.STRIPE_TEST_SECRET_KEY,
    webhookSecret: staged.STRIPE_TEST_WEBHOOK_SECRET,
    mode: "test",
  });
  expect(readPaymentCredentials(staged, "live")).toMatchObject({
    stripeKey: staged.STRIPE_SECRET_KEY,
    webhookSecret: staged.STRIPE_WEBHOOK_SECRET,
    mode: "live",
  });
  expect(checkoutPaymentMode({ ...staged, PAYMENTS_MODE: "live" })).toBe("live");
  expect(checkoutPaymentMode({ ...staged, STRIPE_TEST_SECRET_KEY: "" })).toBeNull();
  expect(checkoutPaymentMode({ ...staged, STRIPE_TEST_WEBHOOK_SECRET: "" })).toBeNull();
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
