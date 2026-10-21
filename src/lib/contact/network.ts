import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/** Trust only Vercel's platform-set address, never arbitrary forwarding headers. */
export function contactRateIdentities(request: Request, secret: string, email: string, onVercel = process.env.VERCEL === "1") {
  const forwarded = onVercel ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  const address = forwarded && isIP(forwarded) ? forwarded.toLowerCase() : "unavailable";
  const hash = (kind: string, value: string) => createHmac("sha256", secret).update(`seen-contact:${kind}:v1:${value}`).digest("hex");
  return { networkHash: hash("network", address), senderHash: hash("sender", email.toLowerCase()) };
}
