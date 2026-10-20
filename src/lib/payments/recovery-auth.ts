import { createHmac, timingSafeEqual } from "node:crypto";

const same = (left: string, right: string) =>
  Buffer.byteLength(left) === Buffer.byteLength(right) &&
  timingSafeEqual(Buffer.from(left), Buffer.from(right));

/** Scheduler responses contain counters only. Never put the long-lived secret
 * into a Supabase pg_net queue: that queue can be readable by database roles.
 * Its scheduler sends a five-minute HMAC proof instead. External schedulers may
 * keep using the existing private Bearer header. */
export function recoveryAuthorised(
  headers: Headers,
  method: string,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!secret || secret.length < 32 || secret.length > 256) return false;
  const bearer = headers.get("authorization");
  if (bearer && same(bearer, `Bearer ${secret}`)) return true;
  if (method !== "POST") return false;
  const timestamp = headers.get("x-seen-recovery-timestamp") || "";
  const signature = headers.get("x-seen-recovery-signature") || "";
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`seen-stock-recovery:v1:${timestamp}:POST:/api/payments/reconcile`)
    .digest("hex");
  return same(signature, expected);
}
