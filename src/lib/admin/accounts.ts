import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { environment } from "@/lib/environment";
import { AdminError } from "./auth";

export function accountService() {
  const config = environment.catalog.supabase;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!config || !key || key.length < 24) throw new AdminError("Account setup needs attention from your website manager.", 503);
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) } });
}
export async function accountRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await accountService().rpc(name, args);
  if (error) {
    if (error.message === "Account rate limit exceeded") throw new AdminError("Too many attempts. Please wait 15 minutes before trying again.", 429);
    if (error.code === "23505") throw new AdminError("That username or email is already in use. Choose another.", 409);
    if (error.message === "Email link is invalid or expired") throw new AdminError("This email link has expired or was already used. Request another from Account settings.", 400);
    if (error.message === "Email address is already in use") throw new AdminError("That email is already used by another account.", 409);
    throw new AdminError("Account setup is unavailable. Ask your website manager to apply the latest account update.", 503);
  }
  return data as T;
}
export async function accountAttempt(request: Request, identifier: string, action: string) {
  const secret = process.env.SUPABASE_SECRET_KEY || "";
  const network = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
  const digest = (value: string) => createHmac("sha256", secret).update(`seen-admin-auth:v1:${value}`).digest("hex");
  await accountRpc("admin_account_attempt", { identity_hash: digest(identifier.toLowerCase()), network_hash: digest(network && isIP(network) ? network : "unconfigured-proxy"), action });
}
export type AccountIdentity = { userId: string; email: string; username: string | null };
export async function lookupAccount(identifier: string) {
  return accountRpc<AccountIdentity | null>("admin_account_lookup", { identifier: identifier.trim().toLowerCase() });
}
/** Called only after this user's password or signed recovery proof was verified. */
export async function removeLegacyAuthenticator(userId: string) {
  const service = accountService();
  const listed = await service.auth.admin.mfa.listFactors({ userId });
  if (listed.error) throw new AdminError("Could not update your sign-in settings. Please try again.", 503);
  for (const factor of listed.data.factors) {
    const removed = await service.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
    if (removed.error) throw new AdminError("Could not finish updating your sign-in settings. Please try again.", 503);
  }
}
async function sendAccountLink(email: string, link: string, subject: string, message: string, nonce: string) {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.ORDER_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL;
  if (!/^re_[A-Za-z0-9_-]{10,}$/.test(apiKey || "") || !z.email().safeParse(from).success)
    throw new AdminError("Account emails are not configured yet. Ask your website manager to connect the email sender.", 503);
  const fixture = process.env.ADMIN_EMAIL_FIXTURE_ORIGIN;
  if (fixture && (fixture !== "http://127.0.0.1:3106" || apiKey !== "re_SEEN_ACCOUNT_FIXTURE_ONLY" || environment.catalog.supabase?.url !== fixture))
    throw new AdminError("Do not use real credentials with account email tests.", 503);
  const response = await fetch(fixture ? `${fixture}/__test/account-email` : "https://api.resend.com/emails", { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `seen-account-${nonce}` },
    body: JSON.stringify({ from, to: [email], subject, text: `${message}\n\n${link}\n\nIf you did not request this, ignore this message.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:540px;margin:40px auto;color:#171717"><p style="letter-spacing:4px">SEEN ABAYAS</p><h1>${subject}</h1><p>${message}</p><p><a href="${link}" style="display:inline-block;padding:14px 20px;background:#171717;color:white;text-decoration:none">Continue securely</a></p><p>If you did not request this, you can ignore it.</p></div>` }) });
  await response.body?.cancel();
  if (!response.ok) throw new AdminError("We could not send the account email. Check the address and try again.", 503);
}
export async function requestAccountEmail(userId: string, email: string, origin: string) {
  const token = randomBytes(32).toString("hex");
  const requestId = await accountRpc<string>("admin_account_email_request", { user_id: userId, email, token_hash: createHash("sha256").update(token).digest("hex") });
  await sendAccountLink(email, `${origin}/admin/email-confirmation?token=${token}`, "Confirm your administrator email", "Confirm this address for sign-in and password recovery. This link expires in 30 minutes.", requestId);
}
export async function sendAccountRecovery(email: string, origin: string) {
  if (email.endsWith("@admin.invalid")) return;
  const result = await accountService().auth.admin.generateLink({ type: "recovery", email });
  if (result.error || !result.data.properties.hashed_token) return;
  const token = result.data.properties.hashed_token;
  await sendAccountLink(email, `${origin}/admin/recover?token_hash=${encodeURIComponent(token)}`, "Reset your SEEN password", "Open the link below to choose a new administrator password. The link can be used once and expires according to your account's recovery settings.", createHash("sha256").update(token).digest("hex"));
}
