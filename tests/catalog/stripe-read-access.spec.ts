import { test, expect } from "@playwright/test";
import { probeStripeReadAccess } from "../../src/lib/payments/permission-probe.mjs";

function fixture(errors: Record<string, unknown> = {}) {
  const calls: { name: string; params?: unknown; options?: unknown }[] = [];
  const response = (name: string, value: unknown) => async (params: unknown, options: unknown) => {
    calls.push({ name, params, options });
    if (errors[name]) throw errors[name];
    return value;
  };
  return {
    calls,
    stripe: {
      checkout: { sessions: { list: response("sessions.list", { data: [{ id: "PRIVATE_SESSION_SENTINEL" }] }) } },
      customers: { list: response("customers.list", { data: [{ email: "PRIVATE_CUSTOMER_SENTINEL" }] }) },
      accounts: { retrieveCurrent: response("account.retrieve", { charges_enabled: true, payouts_enabled: false, email: "PRIVATE_ACCOUNT_SENTINEL" }) },
    },
  };
}

test("Stripe permission probe only makes bounded reads and discards record data", async () => {
  const { stripe, calls } = fixture();
  const before = Math.floor(Date.now() / 1000);
  const result = await probeStripeReadAccess(stripe);
  expect(calls.map(call => call.name)).toEqual(["sessions.list", "customers.list", "account.retrieve"]);
  for (const call of calls) expect(call.options).toEqual({ timeout: 8000, maxNetworkRetries: 0 });
  for (const call of calls.slice(0, 2)) {
    const params = call.params as { limit: number; created: { gte: number } };
    expect(params.limit).toBe(1);
    expect(params.created.gte).toBeGreaterThanOrEqual(before + 86400);
  }
  expect(result).toEqual({
    requiredReadAccess: "passed", checkoutSessionsRead: "passed", customersRead: "passed",
    account: { status: "passed", chargesEnabled: true, payoutsEnabled: false },
    writePermissions: "not_tested", webhookDelivery: "not_tested", paymentMethodEligibility: "not_tested",
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE_");
});

test("optional account denial does not misreport required checkout read permissions", async () => {
  const { stripe } = fixture({ "account.retrieve": { statusCode: 403, message: "PRIVATE_PERMISSION_SENTINEL" } });
  const result = await probeStripeReadAccess(stripe);
  expect(result.requiredReadAccess).toBe("passed");
  expect(result.account).toEqual({ status: "permission_denied", chargesEnabled: null, payoutsEnabled: null });
  expect(JSON.stringify(result)).not.toContain("PRIVATE_");
});

test("required scope denial is reported without echoing Stripe errors or inferring write access", async () => {
  const { stripe } = fixture({ "sessions.list": { type: "StripePermissionError", message: "PRIVATE_ERROR_SENTINEL" } });
  const result = await probeStripeReadAccess(stripe);
  expect(result.requiredReadAccess).toBe("failed");
  expect(result.checkoutSessionsRead).toBe("permission_denied");
  expect(result.customersRead).toBe("passed");
  expect(result.writePermissions).toBe("not_tested");
  expect(JSON.stringify(result)).not.toContain("PRIVATE_");
});

test("authentication, rate-limit and network failures are sanitised and never treated as success", async () => {
  for (const [error, status] of [
    [{ statusCode: 401 }, "authentication_failed"],
    [{ type: "StripeAuthenticationError" }, "authentication_failed"],
    [{ statusCode: 429 }, "rate_limited"],
    [{ statusCode: 503 }, "unavailable"],
    [{ type: "StripeConnectionError" }, "unavailable"],
  ] as const) {
    const value = { ...error, message: "PRIVATE_FAILURE_SENTINEL" };
    const { stripe } = fixture({ "sessions.list": value, "customers.list": value, "account.retrieve": value });
    const result = await probeStripeReadAccess(stripe);
    expect(result.requiredReadAccess).toBe("failed");
    expect(result.checkoutSessionsRead).toBe(status);
    expect(result.customersRead).toBe(status);
    expect(result.account.status).toBe(status);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  }
});
