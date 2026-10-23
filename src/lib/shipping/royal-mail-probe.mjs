import { z } from "zod";

// Official Click & Drop v1 OLP discovery call. No order/label endpoints are used.
const endpoint = "https://api.parcel.royalmail.com/api/v1/services/olp?country=GBR";
const responseSchema = z.object({ services: z.array(z.object({
  brand: z.string().max(100).optional(),
  cost: z.number().finite().nonnegative().nullable().optional(),
  vatCost: z.number().finite().nonnegative().nullable().optional(),
})).max(1000) });

/** @param {string | undefined} key */
export function royalMailConfiguration(key) {
  const valid = typeof key === "string" && key.length >= 8 && key.length <= 512 && /^[\x21-\x7E]+$/.test(key) && !/^["']|["']$/.test(key);
  return { configured: valid, issues: valid ? [] : [{ setting: "ROYAL_MAIL_API_KEY", message: "Add the private Click & Drop API token without quotes, whitespace or a Bearer prefix." }] };
}

/** @param {Response} response */
export async function boundedJson(response) {
  const maximum = 262144;
  if (Number(response.headers.get("content-length")) > maximum || !response.body) throw Error("Invalid response");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw Error("Invalid response"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { reader.releaseLock(); }
}

/**
 * Explicit, read-only access probe. Never returns keys, raw errors, addresses or
 * account prices. Price-field presence does not establish tax/quote semantics.
 * @param {string | undefined} key
 * @param {typeof fetch} fetcher
 * @param {'bearer' | 'raw'} authMode
 */
export async function probeRoyalMailOlp(key, fetcher = fetch, authMode = 'bearer') {
  const configuration = royalMailConfiguration(key);
  const base = { ...configuration, checkoutRates: "not_checked", shipments: "not_implemented" };
  if (!configuration.configured) return { ...base, connection: "not_checked", pricingAccess: "not_checked" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(endpoint, {
      method: "GET", headers: { Authorization: authMode === 'raw' ? key : `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!response.ok) {
      const status = response.status === 401 ? "authentication_failed" : response.status === 403 ? "not_available_for_key"
        : response.status === 429 ? "rate_limited" : "unavailable";
      await response.body?.cancel();
      return { ...base, connection: status, pricingAccess: "not_verified" };
    }
    const parsed = responseSchema.safeParse(await boundedJson(response));
    if (!parsed.success) return { ...base, connection: "invalid_response", pricingAccess: "not_verified" };
    const royalMail = parsed.data.services.filter(service => service.brand === "RoyalMail");
    const priced = royalMail.filter(service => typeof service.cost === "number");
    return { ...base, connection: "passed", pricingAccess: priced.length ? "passed" : "no_priced_royal_mail_services",
      serviceCount: parsed.data.services.length, royalMailServiceCount: royalMail.length, pricedRoyalMailServiceCount: priced.length };
  } catch {
    return { ...base, connection: controller.signal.aborted ? "timed_out" : "unavailable", pricingAccess: "not_verified" };
  } finally { clearTimeout(timer); }
}
