import { expect, test } from "@playwright/test";
import { createContactHandler } from "../../src/lib/contact/handler";
import { contactFieldsSchema, readContactConfig, type ContactConfig } from "../../src/lib/contact/model";

const config: ContactConfig = { apiKey: "re_test_key_never_sent", from: "contact@example.invalid", siteKey: "test_public_site_key", turnstileSecret: "test_secret_never_sent" };
const payload = () => ({ name: "Amina Khan", email: "amina@example.invalid", phone: "+44 (0) 7700 900123", message: "Please help me check the sleeve measurements for the charcoal abaya.", website: "", verificationToken: "synthetic-test-token", requestId: crypto.randomUUID(), submittedAt: new Date().toISOString() });
const request = (body: unknown, headers = {}) => new Request("https://seen.example.invalid/api/contact", { method: "POST", headers: { host: "seen.example.invalid", origin: "https://seen.example.invalid", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("contact configuration is disabled until every required service setting is valid", () => {
  expect(readContactConfig({})).toBeNull();
  expect(readContactConfig({ RESEND_API_KEY: config.apiKey, CONTACT_FROM_EMAIL: config.from })).toBeNull();
  expect(readContactConfig({ RESEND_API_KEY: config.apiKey, CONTACT_FROM_EMAIL: config.from, CONTACT_TURNSTILE_SITE_KEY: config.siteKey, CONTACT_TURNSTILE_SECRET_KEY: config.turnstileSecret })).toEqual(config);
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
