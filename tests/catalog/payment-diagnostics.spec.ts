import { test, expect } from "@playwright/test";
import { paymentConfigurationReport } from "../../src/lib/payments/diagnostics.mjs";
import { checkoutPaymentMode } from "../../src/lib/payments/config.mjs";

const live = {
  NEXT_PUBLIC_SITE_URL: "https://www.seenabayas.co.uk",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_fixture_diagnostic_not_real",
  CATALOG_SOURCE: "supabase", CMS_SOURCE: "supabase",
  PAYMENTS_MODE: "live", PAYMENTS_TAX_MODE: "none",
  STRIPE_SECRET_KEY: "rk_live_diagnostic_not_real",
  STRIPE_WEBHOOK_SECRET: "whsec_live_diagnostic_not_real",
  STRIPE_TEST_SECRET_KEY: "rk_test_diagnostic_not_real",
  STRIPE_TEST_WEBHOOK_SECRET: "whsec_test_diagnostic_not_real",
};

test("diagnostic reports valid restricted live and retained sandbox modes without credentials", () => {
  for (const mode of ["live", "test"]) {
    const report = paymentConfigurationReport({ ...live, PAYMENTS_MODE: mode });
    expect(report).toEqual({ requestedMode: mode, configuredMode: mode, issues: [] });
    const serialized = JSON.stringify(report);
    for (const setting of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_TEST_SECRET_KEY", "STRIPE_TEST_WEBHOOK_SECRET", "SUPABASE_SECRET_KEY"] as const)
      expect(serialized).not.toContain(live[setting]);
  }
});

test("diagnostic identifies rejected live settings without enabling checkout or echoing supplied values", () => {
  const cases = [
    ["PAYMENTS_MODE", "live ", "PAYMENTS_MODE"],
    ["PAYMENTS_TAX_MODE", "unconfirmed", "PAYMENTS_TAX_MODE"],
    ["STRIPE_SECRET_KEY", "sk_test_wrong_environment", "STRIPE_SECRET_KEY"],
    ["STRIPE_TEST_SECRET_KEY", "", "STRIPE_TEST_SECRET_KEY"],
    ["STRIPE_WEBHOOK_SECRET", "whsec_invalid whitespace", "STRIPE_WEBHOOK_SECRET"],
    ["STRIPE_TEST_WEBHOOK_SECRET", live.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET / STRIPE_TEST_WEBHOOK_SECRET"],
    ["CATALOG_SOURCE", "development", "CATALOG_SOURCE"],
    ["CMS_SOURCE", "files", "CMS_SOURCE"],
    ["NEXT_PUBLIC_SITE_URL", "http://localhost:3000", "NEXT_PUBLIC_SITE_URL"],
    ["NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co/rest/v1", "NEXT_PUBLIC_SUPABASE_URL"],
    ["SUPABASE_SECRET_KEY", "sb_publishable_not_a_server_key", "SUPABASE_SECRET_KEY"],
    ["PAYMENTS_FIXTURE_ORIGIN", "http://127.0.0.1:3108", "PAYMENTS_FIXTURE_ORIGIN"],
  ];
  for (const [setting, value, expected] of cases) {
    const config = { ...live, [setting]: value };
    const report = paymentConfigurationReport(config);
    expect(checkoutPaymentMode(config)).toBeNull();
    expect(report.configuredMode).toBeNull();
    expect(report.issues.map(issue => issue.setting)).toContain(expected);
    if (value && (setting.startsWith("STRIPE_") || setting === "SUPABASE_SECRET_KEY"))
      expect(JSON.stringify(report.issues)).not.toContain(value);
  }
});

test("invalid or disabled mode values are sanitised and do not expose their contents", () => {
  const invalid = paymentConfigurationReport({ ...live, PAYMENTS_MODE: "SECRET_SENTINEL_DO_NOT_ECHO" });
  expect(invalid.requestedMode).toBe("invalid");
  expect(JSON.stringify(invalid)).not.toContain("SECRET_SENTINEL_DO_NOT_ECHO");
  expect(paymentConfigurationReport({ ...live, PAYMENTS_MODE: "disabled" }).configuredMode).toBeNull();
  expect(paymentConfigurationReport({ ...live, PAYMENTS_MODE: undefined }).requestedMode).toBe("disabled");
});
