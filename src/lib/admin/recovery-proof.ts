import { createHmac, timingSafeEqual } from "node:crypto";
export const recoveryCookie = "seen.admin.recovery";
const proof = (body: string, secret: string) => createHmac("sha256", secret).update(`seen-account-recovery:v1:${body}`).digest();
export function recoveryProof(userId: string, sessionId: string, secret: string, now = Date.now()) {
  if (secret.length < 24 || !sessionId) throw Error("Recovery is not configured");
  const body = Buffer.from(JSON.stringify({ userId, sessionId, expires: now + 10 * 60_000 })).toString("base64url");
  return `${body}.${proof(body, secret).toString("base64url")}`;
}
export function validRecoveryProof(value: string | undefined, userId: string, sessionId: string, secret: string, now = Date.now()) {
  try {
    if (!value || value.length > 2048 || secret.length < 24 || !sessionId) return false;
    const [body, signature, extra] = value.split(".");
    if (!body || !signature || extra !== undefined) return false;
    const actual = Buffer.from(signature, "base64url"), expected = proof(body, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return data.userId === userId && data.sessionId === sessionId && data.expires > now && data.expires <= now + 10 * 60_000;
  } catch { return false; }
}
export function sessionIdentity(accessToken: string) {
  try { return String(JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")).session_id || ""); }
  catch { return ""; }
}
