import { createHash, randomUUID } from "node:crypto";

import { ContactDeliveryError, contactRequestSchema, type ContactConfig, type ContactRequest } from "./model";

const recipient = "info@seenabayas.co.uk";
const unavailable = "We couldn't send your message. Please try again or email info@seenabayas.co.uk.";
const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...extraHeaders } });

// A bounded process-local limit supplements Turnstile. Configure a shared hosting/WAF
// limit for /api/contact before production; memory is not shared across server instances.
export function createContactHandler() {
  const attempts = new Map<string, { count: number; expires: number }>();
  let globalCount = 0;
  let globalExpiry = 0;
  function limited(email: string, now: number) {
    for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
    if (globalExpiry <= now) { globalCount = 0; globalExpiry = now + 60_000; }
    if (globalCount >= 30) return true;
    globalCount++;
    const key = createHash("sha256").update(email.toLowerCase()).digest("hex");
    const entry = attempts.get(key);
    if (entry && entry.count >= 3) return true;
    if (!entry && attempts.size >= 4096) return true;
    attempts.set(key, { count: (entry?.count || 0) + 1, expires: entry?.expires || now + 15 * 60_000 });
    return false;
  }

  return async function handleContact(request: Request, config: ContactConfig | null, fetcher: typeof fetch = fetch, storeEnquiry?: (data: ContactRequest) => Promise<void>) {
    let origin: URL;
    try {
      origin = new URL(request.headers.get("origin") || "");
      if (!["http:", "https:"].includes(origin.protocol) || origin.host !== request.headers.get("host") || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Please refresh the page and try again." }, 403);
    } catch { return json({ error: "Please refresh the page and try again." }, 403); }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Invalid message request." }, 415);
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "Invalid message request." }, 400);
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 32_768) { await reader.cancel(); return json({ error: "Your message is too long." }, 413); }
        chunks.push(value);
      }
      let body: unknown;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json({ error: "Invalid message request." }, 400); }
      const parsed = contactRequestSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Please check your name, email, phone number and message." }, 400);
      const data = parsed.data;
      const now = Date.now();
      const age = now - Date.parse(data.submittedAt);
      if (data.website || age < -60_000 || age > 23 * 60 * 60_000) return json({ error: "Please refresh the form and try again." }, 400);
      if (!config) return json({ error: "Our contact form is currently unavailable. Please email info@seenabayas.co.uk." }, 503);

      // Inbox-only delivery uses atomic database limits and never calls an
      // email or CAPTCHA provider. A receipt requires durable message storage.
      if (config.delivery === "inbox") {
        if (!storeEnquiry) return json({ error: unavailable }, 503);
        await storeEnquiry(data);
        return json({ success: true });
      }
      if (!data.verificationToken) return json({ error: "Please complete the security check again." }, 400);

      const verification = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(8_000),
        body: new URLSearchParams({ secret: config.turnstileSecret, response: data.verificationToken, idempotency_key: randomUUID() }),
      });
      if (!verification.ok) return json({ error: unavailable }, 503);
      const verified = await verification.json();
      if (verified?.success !== true || verified.action !== "contact" || verified.hostname !== origin.hostname) return json({ error: "Please complete the security check again." }, 400);
      if (limited(data.email, now)) return json({ error: "Please wait a little before sending another message, or email our team directly." }, 429, { "Retry-After": "900" });

      // Plain text keeps customer input out of HTML and mail headers. The fixed
      // recipient/sender cannot be overridden by a request. Retries retain the
      // same request ID, submission time and payload for provider idempotency.
      const delivered = await fetcher("https://api.resend.com/emails", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `seen-contact/${data.requestId}` },
        body: JSON.stringify({
          from: `SEEN ABAYAS <${config.from}>`, to: [config.recipient || recipient], reply_to: data.email,
          subject: "New SEEN ABAYAS customer enquiry",
          text: `SEEN ABAYAS customer enquiry\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nSubmitted (UTC): ${data.submittedAt}\nReference: ${data.requestId}\n\nMessage:\n${data.message}`,
        }),
      });
      if (!delivered.ok) return json({ error: unavailable }, 503);
      const accepted = await delivered.json();
      if (typeof accepted?.id !== "string" || !accepted.id) return json({ error: unavailable }, 503);
      if (storeEnquiry) await storeEnquiry(data);
      return json({ success: true });
    } catch (error) {
      if (error instanceof ContactDeliveryError) return json({ error: error.message }, error.status, error.status === 429 ? { "Retry-After": "900" } : {});
      return json({ error: unavailable }, 503);
    }
  };
}
