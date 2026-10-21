import { test, expect } from "@playwright/test";

test("payment readiness requires owner MFA, reveals no credentials and makes no payment or stock changes", async ({ request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
  await request.get("http://127.0.0.1:3108/__test/reset");
  const endpoint = "/api/admin/payments/readiness";
  const options = { headers: { Origin: "http://127.0.0.1:3107" } };
  expect((await request.get(endpoint)).status()).toBe(401);
  expect((await request.post("/api/admin/auth", { ...options, data: { action: "login", email: "owner@example.test", password: "Test-password-only-123" } })).status()).toBe(200);
  expect((await request.get(endpoint)).status()).toBe(403);
  const profile = await (await request.get("/api/admin/auth")).json();
  expect((await request.post("/api/admin/auth", { ...options, data: { action: "verify", factorId: profile.factors[0].id, code: "123456" } })).status()).toBe(200);
  const before = await (await request.get("http://127.0.0.1:3108/__test/state")).json();
  const response = await request.get(endpoint);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const body = await response.json();
  expect(body).toEqual({ requestedMode: "live", configuredMode: "live", readyMode: "live", issues: [], database: "ready", providerPermissions: "not_tested" });
  expect(JSON.stringify(body)).not.toContain("SEEN_LOCAL");
  expect(await (await request.get("http://127.0.0.1:3108/__test/state")).json()).toEqual(before);
  try {
    await request.post("http://127.0.0.1:3108/__test/admin-role", { data: { role: "editor" } });
    expect((await request.get(endpoint)).status()).toBe(403);
  } finally {
    await request.post("http://127.0.0.1:3108/__test/admin-role", { data: { role: "owner" } });
  }
});
