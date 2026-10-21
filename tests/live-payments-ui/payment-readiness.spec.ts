import { test, expect } from "@playwright/test";

test("payment readiness requires owner MFA, reveals no credentials and makes no payment or stock changes", async ({ request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
  await request.get("http://127.0.0.1:3108/__test/reset");
  const endpoint = "/api/admin/payments/readiness";
  const providerEndpoint = `${endpoint}?stripe=read&mode=test`;
  const options = { headers: { Origin: "http://127.0.0.1:3107" } };
  expect((await request.get(endpoint)).status()).toBe(401);
  expect((await request.get(providerEndpoint)).status()).toBe(401);
  expect((await request.post("/api/admin/auth", { ...options, data: { action: "login", email: "owner@example.test", password: "Test-password-only-123" } })).status()).toBe(200);
  expect((await request.get(endpoint)).status()).toBe(403);
  expect((await request.get(providerEndpoint)).status()).toBe(403);
  const profile = await (await request.get("/api/admin/auth")).json();
  expect((await request.post("/api/admin/auth", { ...options, data: { action: "verify", factorId: profile.factors[0].id, code: "123456" } })).status()).toBe(200);
  const before = await (await request.get("http://127.0.0.1:3108/__test/state")).json();
  const response = await request.get(endpoint);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const body = await response.json();
  expect(body).toEqual({ requestedMode: "live", configuredMode: "live", readyMode: "live", issues: [], database: "ready", providerPermissions: "not_tested" });
  expect(JSON.stringify(body)).not.toContain("SEEN_LOCAL");
  const providerResponse = await request.get(providerEndpoint);
  expect(providerResponse.status()).toBe(200);
  expect(providerResponse.headers()["cache-control"]).toBe("private, no-store");
  const provider = await providerResponse.json();
  expect(provider.providerPermissions).toBe("read_checks_completed");
  expect(provider.providerAccess).toEqual({
    environment: "live", requiredReadAccess: "passed", checkoutSessionsRead: "passed", customersRead: "passed",
    account: { status: "passed", chargesEnabled: true, payoutsEnabled: true },
    writePermissions: "not_tested", webhookDelivery: "not_tested", paymentMethodEligibility: "not_tested",
  });
  expect(JSON.stringify(provider)).not.toContain("SEEN_LOCAL");
  expect(JSON.stringify(provider)).not.toContain("PRIVATE_FIXTURE_ACCOUNT");
  expect(await (await request.get("http://127.0.0.1:3108/__test/state")).json()).toEqual(before);
  try {
    await request.post("http://127.0.0.1:3108/__test/recovery", { data: { unavailable: true } });
    const unavailable = await (await request.get(providerEndpoint)).json();
    expect(unavailable.readyMode).toBe("live");
    expect(unavailable.providerAccess.requiredReadAccess).toBe("failed");
    expect(unavailable.providerAccess.checkoutSessionsRead).toBe("unavailable");
    expect(unavailable.providerAccess.customersRead).toBe("unavailable");
  } finally {
    await request.post("http://127.0.0.1:3108/__test/recovery", { data: { unavailable: false } });
  }
  try {
    await request.post("http://127.0.0.1:3108/__test/admin-role", { data: { role: "editor" } });
    expect((await request.get(endpoint)).status()).toBe(403);
    expect((await request.get(providerEndpoint)).status()).toBe(403);
  } finally {
    await request.post("http://127.0.0.1:3108/__test/admin-role", { data: { role: "owner" } });
  }
});
