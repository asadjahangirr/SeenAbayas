import { expect, test } from "@playwright/test";
import { createContactHandler } from "../../src/lib/contact/handler";
import { contactFieldsSchema, readContactConfig, type ContactConfig } from "../../src/lib/contact/model";
import { contactRateIdentities } from "../../src/lib/contact/network";

const config: ContactConfig = { delivery: "email", apiKey: "re_test_key_never_sent", from: "contact@example.invalid", siteKey: "test_public_site_key", turnstileSecret: "test_secret_never_sent" };
const payload = () => ({ name: "Amina Khan", email: "amina@example.invalid", phone: "+44 (0) 7700 900123", message: "Please help me check the sleeve measurements for the charcoal abaya.", website: "", verificationToken: "synthetic-test-token", requestId: crypto.randomUUID(), submittedAt: new Date().toISOString() });
const request = (body: unknown, headers = {}) => new Request("https://seen.example.invalid/api/contact", { method: "POST", headers: { host: "seen.example.invalid", origin: "https://seen.example.invalid", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("contact configuration is disabled until every required service setting is valid", () => {
  expect(readContactConfig({})).toBeNull();
  expect(readContactConfig({ RESEND_API_KEY: config.apiKey, CONTACT_FROM_EMAIL: config.from })).toBeNull();
  expect(readContactConfig({ CONTACT_DELIVERY: "email", RESEND_API_KEY: config.apiKey, CONTACT_FROM_EMAIL: config.from, CONTACT_TURNSTILE_SITE_KEY: config.siteKey, CONTACT_TURNSTILE_SECRET_KEY: config.turnstileSecret })).toEqual(config);
});

test("inbox mode needs protected database access without email or CAPTCHA credentials", () => {
  const values = { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_SEEN_LOCAL_FIXTURE_ONLY" };
  expect(readContactConfig(values)).toEqual({ delivery: "inbox" });
  for (const changes of [{ SUPABASE_SECRET_KEY: "sb_publishable_wrong_role" }, { SUPABASE_SECRET_KEY: "" }, { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co/unsafe" }, { CONTACT_DELIVERY: "unknown" }]) expect(readContactConfig({ ...values, ...changes })).toBeNull();
});

test("inbox-only delivery acknowledges durable storage and never calls an email provider", async () => {
  const inbox: ContactConfig = { delivery: "inbox" };
  const data = { ...payload(), verificationToken: "" };
  const saved: unknown[] = [];
  const fetcher: typeof fetch = async () => { throw new Error("Inbox mode must not call an external verification or email provider"); };
  const handler = createContactHandler();
  for (let i = 0; i < 2; i++) {
    const response = await handler(request(data), inbox, fetcher, async message => { saved.push(message); });
    expect(await response.json()).toEqual({ success: true });
  }
  expect(saved).toEqual([data, data]);
  expect((await createContactHandler()(request(data), inbox, fetcher)).status).toBe(503);
  const failure = await createContactHandler()(request(data), inbox, fetcher, async () => { throw new Error("Private database diagnostic"); });
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("Private database diagnostic");
});

test("inbox-only mode still rejects honeypot spam without storing a message", async () => {
  let stored = false;
  const response = await createContactHandler()(request({ ...payload(), website: "spam.invalid", verificationToken: "" }), { delivery: "inbox" }, async () => { throw Error("No provider should be called"); }, async () => { stored = true; });
  expect(response.status).toBe(400);
  expect(stored).toBe(false);
});

test("network quotas use only trusted Vercel headers and HMAC identities", () => {
  const make = (forwarded: string) => request(payload(), { "x-vercel-forwarded-for": forwarded, "x-forwarded-for": "198.51.100.99" });
  const a = contactRateIdentities(make("203.0.113.1"), "fixture-only-secret", "TEST@example.test", true);
  expect(a).toEqual(contactRateIdentities(make("203.0.113.1"), "fixture-only-secret", "test@example.test", true));
  expect(a.networkHash).toMatch(/^[a-f0-9]{64}$/);
  expect(a.networkHash).not.toContain("203.0.113.1");
  expect(a.networkHash).not.toBe(contactRateIdentities(make("203.0.113.2"), "fixture-only-secret", "test@example.test", true).networkHash);
  expect(contactRateIdentities(make("203.0.113.1"), "fixture-only-secret", "test@example.test", false)).toEqual(contactRateIdentities(make("203.0.113.2"), "fixture-only-secret", "test@example.test", false));
  expect(contactRateIdentities(make("not an address"), "fixture-only-secret", "test@example.test", true)).toEqual(contactRateIdentities(make(""), "fixture-only-secret", "test@example.test", true));
});

test("contact fields support international phone formats and reject header injection or invalid values", () => {
  const { name, email, phone, message } = payload();
  const fields = { name, email, phone, message };
  expect(contactFieldsSchema.safeParse(fields).success).toBe(true);
  expect(contactFieldsSchema.safeParse({ ...fields, phone: "+92 300 1234567" }).success).toBe(true);
  for (const invalid of [{ name: "A\r\nBcc: bad@example.invalid" }, { email: "bad\n@example.invalid" }, { phone: "hello123" }, { phone: "+1234567890123456" }, { message: "short" }]) expect(contactFieldsSchema.safeParse({ ...fields, ...invalid }).success).toBe(false);
});

test("contact handler fails closed without email configuration and never calls an external service", async () => {
  const result = await createContactHandler()(request(payload()), null, async () => { throw new Error("Unexpected external request"); });
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: "Our contact form is currently unavailable. Please email info@seenabayas.co.uk." });
});

test("contact handler rejects cross-origin, unsupported media, extra fields, spam and oversized bodies", async () => {
  const handler = createContactHandler();
  const forbidden = async () => { throw new Error("Unexpected external request"); };
  expect((await handler(request(payload(), { origin: "https://foreign.example.invalid" }), config, forbidden)).status).toBe(403);
  expect((await handler(request(payload(), { origin: "" }), config, forbidden)).status).toBe(403);
  expect((await handler(request(payload(), { "content-type": "text/plain" }), config, forbidden)).status).toBe(415);
  expect((await handler(request({ ...payload(), to: "other@example.invalid" }), config, forbidden)).status).toBe(400);
  expect((await handler(request({ ...payload(), website: "spam.invalid" }), config, forbidden)).status).toBe(400);
  expect((await handler(request({ ...payload(), message: "x".repeat(40_000) }), config, forbidden)).status).toBe(413);
  expect((await handler(request({ ...payload(), submittedAt: "2020-01-01T00:00:00.000Z" }), config, forbidden)).status).toBe(400);
});

test("contact verification validates success, hostname and action before sending", async () => {
  for (const verification of [{ success: false }, { success: true, hostname: "foreign.invalid", action: "contact" }, { success: true, hostname: "seen.example.invalid", action: "login" }]) {
    let calls = 0;
    const result = await createContactHandler()(request(payload()), config, async (url) => { calls++; expect(String(url)).toContain("/siteverify"); return Response.json(verification); });
    expect(result.status).toBe(400);
    expect(calls).toBe(1);
  }
});

test("contact email uses the fixed recipient, reply-to and plain text; provider acceptance is required", async () => {
  const data = payload();
  data.message = "<script>alert('test')</script> Please check this design.";
  const emailRequests: RequestInit[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).includes("/siteverify")) return Response.json({ success: true, hostname: "seen.example.invalid", action: "contact" });
    expect(String(url)).toBe("https://api.resend.com/emails");
    emailRequests.push(init!);
    return Response.json({ id: "accepted-test-email" });
  };
  const handler = createContactHandler();
  for (let retry = 0; retry < 2; retry++) {
    const result = await handler(request(data), config, fetcher);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ success: true });
    expect(result.headers.get("cache-control")).toContain("no-store");
  }
  expect(emailRequests[0].body).toBe(emailRequests[1].body);
  expect(new Headers(emailRequests[0].headers).get("Idempotency-Key")).toBe(`seen-contact/${data.requestId}`);
  const email = JSON.parse(String(emailRequests[0].body));
  expect(email.to).toEqual(["info@seenabayas.co.uk"]);
  expect(email.from).toBe("SEEN ABAYAS <contact@example.invalid>");
  expect(email.reply_to).toBe(data.email);
  expect(email.html).toBeUndefined();
  for (const value of [data.name, data.email, data.phone, data.message, data.submittedAt]) expect(email.text).toContain(value);
});

test("contact form never reports success after provider rejection, malformed response or timeout", async () => {
  for (const failure of ["rejected", "malformed", "timeout"]) {
    const result = await createContactHandler()(request(payload()), config, async (url) => {
      if (String(url).includes("/siteverify")) return Response.json({ success: true, hostname: "seen.example.invalid", action: "contact" });
      if (failure === "timeout") throw new DOMException("Timed out", "TimeoutError");
      return failure === "rejected" ? Response.json({ message: "Private provider detail" }, { status: 422 }) : Response.json({});
    });
    expect(result.status).toBe(503);
    const text = await result.text();
    expect(text).not.toContain("Private provider detail");
    expect(text).not.toContain(config.apiKey);
    expect(text).not.toContain('"success":true');
  }
});

test("contact rate limiting prevents repeated sends after successful verification", async () => {
  const handler = createContactHandler();
  let sends = 0;
  const fetcher: typeof fetch = async (url) => {
    if (String(url).includes("/siteverify")) return Response.json({ success: true, hostname: "seen.example.invalid", action: "contact" });
    sends++;
    return Response.json({ id: "accepted-test-email" });
  };
  for (let count = 0; count < 3; count++) expect((await handler(request(payload()), config, fetcher)).status).toBe(200);
  const rejected = await handler(request(payload()), config, fetcher);
  expect(rejected.status).toBe(429);
  expect(rejected.headers.get("retry-after")).toBe("900");
  expect(sends).toBe(3);
});
