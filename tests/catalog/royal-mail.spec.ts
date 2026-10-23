import { test, expect } from "@playwright/test";
import { probeRoyalMailOlp, royalMailConfiguration } from "../../src/lib/shipping/royal-mail-probe.mjs";

const key = "PRIVATE_TEST_KEY_NEVER_SENT";
test("missing or malformed Royal Mail configuration makes no provider call or secret echo", async () => {
  for (const value of [undefined, "", " abcdefgh", "abcdefgh ", '"abcdefgh"', "Bearer abcdefgh", "abcd\nefgh"]) {
    expect(royalMailConfiguration(value).configured).toBe(false);
    expect(await probeRoyalMailOlp(value, async () => { throw Error("Must not call"); })).toMatchObject({ configured: false, connection: "not_checked" });
  }
  expect(JSON.stringify(royalMailConfiguration(key))).not.toContain(key);
});
test("read probe calls only the fixed OLP GET and returns counts without keys, prices or raw guidance", async () => {
  let calls = 0;
  const report = await probeRoyalMailOlp(key, async (input, init) => {
    calls++;
    expect(String(input)).toBe("https://api.parcel.royalmail.com/api/v1/services/olp?country=GBR");
    expect(init).toMatchObject({ method: "GET", cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${key}` } });
    expect(init?.body).toBeUndefined();
    return Response.json({ guidanceText: "PRIVATE_GUIDANCE", services: [
      { brand: "RoyalMail", cost: 4.25, vatCost: 0.85 }, { brand: "Parcelforce", cost: 9.99 },
    ] });
  });
  expect(calls).toBe(1);
  expect(report).toMatchObject({ configured: true, connection: "passed", pricingAccess: "passed", serviceCount: 2, royalMailServiceCount: 1, pricedRoyalMailServiceCount: 1, checkoutRates: "not_checked", shipments: "not_implemented" });
  for (const privateValue of [key, "PRIVATE_GUIDANCE", "4.25", "0.85", "9.99"]) expect(JSON.stringify(report)).not.toContain(privateValue);
});
test("authentication, account entitlement, rate limit and provider errors remain distinct and sanitised", async () => {
  for (const [status, connection] of [[401, "authentication_failed"], [403, "not_available_for_key"], [429, "rate_limited"], [503, "unavailable"]] as const) {
    const report = await probeRoyalMailOlp(key, async () => new Response(`PRIVATE_ERROR ${key}`, { status }));
    expect(report).toMatchObject({ connection, pricingAccess: "not_verified" });
    expect(JSON.stringify(report)).not.toContain(key);
    expect(JSON.stringify(report)).not.toContain("PRIVATE_ERROR");
  }
});
test("non-Royal Mail services or absent costs do not prove usable Royal Mail prices", async () => {
  expect(await probeRoyalMailOlp(key, async () => Response.json({ services: [{ brand: "Parcelforce", cost: 5 }, { brand: "RoyalMail" }] })))
    .toMatchObject({ connection: "passed", pricingAccess: "no_priced_royal_mail_services", pricedRoyalMailServiceCount: 0 });
});
test("invalid schemas, negative costs and oversized bodies are never accepted or echoed", async () => {
  for (const value of [{}, { services: [{ brand: "RoyalMail", cost: -1 }] }]) {
    expect(await probeRoyalMailOlp(key, async () => Response.json(value))).toMatchObject({ connection: "invalid_response", pricingAccess: "not_verified" });
  }
  expect(await probeRoyalMailOlp(key, async () => new Response("x".repeat(262145)))).toMatchObject({ connection: "unavailable", pricingAccess: "not_verified" });
});
test("transport errors do not escape or expose a key in their message", async () => {
  const report = await probeRoyalMailOlp(key, async () => { throw Error(key); });
  expect(report.connection).toBe("unavailable");
  expect(JSON.stringify(report)).not.toContain(key);
});
