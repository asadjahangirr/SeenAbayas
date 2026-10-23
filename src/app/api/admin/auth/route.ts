import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { accountAttempt, lookupAccount, accountService, accountRpc, removeLegacyAuthenticator, requestAccountEmail, sendAccountRecovery } from "@/lib/admin/accounts";
import { recoveryCookie, recoveryProof, validRecoveryProof, sessionIdentity } from "@/lib/admin/recovery-proof";
import {
  adminClient,
  AdminError,
  requireAdmin,
  checkOrigin,
  readAdminBody,
  privateJson,
  adminFailure,
} from "@/lib/admin/auth";

const login = z
  .object({
    action: z.literal("login"),
    email: z.string().trim().min(3).max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
const code = z.string().regex(/^\d{6}$/);
export async function GET() {
  try {
    const { client, user, role, mfa, passwordOnly } = await requireAdmin(false);
    const factors = passwordOnly ? null : await client.auth.mfa.listFactors();
    return privateJson({
      email: user.email?.endsWith("@admin.invalid") ? null : user.email,
      passwordOnly,
      role,
      mfa,
      factors:
        factors?.data?.totp
          .filter((f) => f.status === "verified")
          .map((f) => ({ id: f.id, name: f.friendly_name })) || [],
    });
  } catch (e) {
    return adminFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const origin = new URL(request.headers.get("origin")!).origin;
    const body = await readAdminBody(request);
    if (body.action === "login") {
      const input = login.parse(body);
      await accountAttempt(request, input.email, "login");
      const identity = await lookupAccount(input.email);
      if (!identity) throw new AdminError("Sign-in failed. Check your email or username and password.", 401);
      const client = await adminClient();
      const result = await client.auth.signInWithPassword({
        email: identity.email,
        password: input.password,
      });
      if (result.error)
        throw new AdminError(
          "Sign-in failed. Check your email and password.",
          401,
        );
      try {
        const access = await requireAdmin(false);
        if (access.passwordOnly) {
          await removeLegacyAuthenticator(access.user.id);
          await client.auth.refreshSession();
        }
      } catch (e) {
        await client.auth.signOut();
        throw e;
      }
      return privateJson({ success: true });
    }
    if (body.action === "recover-request") {
      const identifier = z.string().trim().min(3).max(254).parse(body.email);
      await accountAttempt(request, identifier, "recover");
      const identity = await lookupAccount(identifier);
      // Do not expose whether an administrator or linked email exists.
      if (identity && !identity.email.endsWith("@admin.invalid"))
        await sendAccountRecovery(identity.email, origin).catch(() => {});
      // Keep account existence and provider responses private.
      return privateJson({ success: true });
    }
    if (body.action === "confirm-email") {
      const token = z.string().regex(/^[a-f0-9]{64}$/).parse(body.token);
      await accountAttempt(request, token, "confirm");
      const claimed = await accountRpc<{userId:string;email:string;previousEmail:string}>("admin_account_claim_email", { token_hash: createHash("sha256").update(token).digest("hex") });
      const result = await accountService().auth.admin.updateUserById(claimed.userId, { email: claimed.email, email_confirm: true });
      if (result.error) throw new AdminError("The email could not be updated. Request a new verification link from Account settings.", 503);
      return privateJson({ success: true });
    }
    if (body.action === "recover-verify") {
      const tokenHash = z.string().min(20).max(512).parse(body.tokenHash);
      await accountAttempt(request, createHash("sha256").update(tokenHash).digest("hex"), "recover");
      const client = await adminClient();
      const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (verified.error || !verified.data.session) throw new AdminError("This reset link has expired or was already used. Request a new one.", 400);
      const access = await requireAdmin(false);
      if (!access.passwordOnly) throw new AdminError("Ask your website manager to finish the account update.", 503);
      const jar = await cookies();
      jar.set(recoveryCookie, recoveryProof(access.user.id, sessionIdentity(verified.data.session.access_token), process.env.SUPABASE_SECRET_KEY || ""), {
        httpOnly:true, sameSite:"lax", secure:request.headers.get("origin")?.startsWith("https:"), path:"/", maxAge:600,
      });
      return privateJson({ success:true });
    }
    const { client, mfa, passwordOnly, user, role } = await requireAdmin(false);
    if (body.action === "logout") {
      (await cookies()).delete(recoveryCookie);
      await client.auth.signOut();
      return privateJson({ success: true });
    }
    if (body.action === "enroll") {
      if (passwordOnly) throw new AdminError("An authenticator is not required for this account.", 400);
      const factors = await client.auth.mfa.listFactors();
      if (factors.data?.totp.some((f) => f.status === "verified") && !mfa)
        throw new AdminError("Verify your existing authenticator first.", 403);
      for (const f of factors.data?.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      ) || [])
        await client.auth.mfa.unenroll({ factorId: f.id });
      const result = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SEEN administration",
      });
      if (result.error)
        throw new AdminError(
          "Could not set up the authenticator. Please try again.",
        );
      return privateJson({
        factorId: result.data.id,
        qr: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
    }
    if (body.action === "verify") {
      const factorId = z.uuid().parse(body.factorId);
      const result = await client.auth.mfa.challengeAndVerify({
        factorId,
        code: code.parse(body.code),
      });
      if (result.error)
        throw new AdminError(
          "The authenticator code was not accepted. Try the latest code.",
          401,
        );
      return privateJson({ success: true });
    }
    if (body.action === "create-admin") {
      if (!passwordOnly || role !== "owner") throw new AdminError("Only the store owner can add an administrator.", 403);
      const input = z.object({ username:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9._-]{2,39}$/), displayName:z.string().trim().min(1).max(80), password:z.string().min(14).max(128), role:z.enum(["owner","editor"]), current:z.string().min(1).max(128) }).strict().parse(body.input);
      await accountAttempt(request, user.id, "create");
      const verified = await client.auth.signInWithPassword({email:user.email!,password:input.current});
      if (verified.error) throw new AdminError("Current password was not accepted.", 401);
      await requireAdmin();
      const service = accountService();
      const created = await service.auth.admin.createUser({ email:`${randomUUID()}@admin.invalid`, email_confirm:true, password:input.password, user_metadata:{display_name:input.displayName} });
      if (created.error || !created.data.user) throw new AdminError("Could not create this administrator. Check the password and try again.", 400);
      try { await accountRpc("admin_account_register", {operator_id:user.id,user_id:created.data.user.id,username:input.username,display_name:input.displayName,member_role:input.role}); }
      catch(error) { await service.auth.admin.deleteUser(created.data.user.id); throw error; }
      return privateJson({success:true,username:input.username});
    }
    if (["password", "email", "recover-password"].includes(body.action)) {
      const nextPassword =
        body.action === "email"
          ? undefined
          : z.string().min(14).max(128).parse(body.password);
      const nextEmail =
        body.action === "email"
          ? z.email().max(254).parse(body.email)
          : undefined;
      if (body.action !== "recover-password") {
        const { user } = await requireAdmin();
        const current = z.string().min(1).max(128).parse(body.current);
        const verify = await client.auth.signInWithPassword({
          email: user.email!,
          password: current,
        });
        if (verify.error)
          throw new AdminError("Current password was not accepted.", 401);
      }
      if (passwordOnly) {
        await accountAttempt(request, user.id, body.action === "email" ? "email" : "password");
        if (body.action === "recover-password") {
          const session = await client.auth.getSession();
          const jar = await cookies();
          if (!validRecoveryProof(jar.get(recoveryCookie)?.value, user.id, sessionIdentity(session.data.session?.access_token || ""), process.env.SUPABASE_SECRET_KEY || ""))
            throw new AdminError("Open a fresh password-reset email before choosing a new password.", 403);
        }
        await removeLegacyAuthenticator(user.id);
        if (body.action === "email") {
          await requestAccountEmail(user.id, nextEmail!, origin);
          return privateJson({success:true,pendingConfirmation:true});
        }
        const changed = await client.auth.updateUser({password:nextPassword});
        if (changed.error) throw new AdminError("Password change failed. Check the password requirements and try again.", 400);
        (await cookies()).delete(recoveryCookie);
        await client.auth.signOut({scope:"global"});
        return privateJson({success:true,signedOut:true});
      }
      // Password verification can lower assurance. Require a fresh TOTP challenge.
      const result = await client.auth.mfa.challengeAndVerify({
        factorId: z.uuid().parse(body.factorId),
        code: code.parse(body.code),
      });
      if (result.error)
        throw new AdminError(
          "Verify a current authenticator code before changing your password.",
          403,
        );
      await requireAdmin();
      if (body.action === "email") {
        const change = await client.auth.updateUser(
          { email: nextEmail },
          {
            emailRedirectTo: `${request.headers.get("origin")}/admin/auth/callback?intent=email`,
          },
        );
        if (change.error)
          throw new AdminError(
            "Email change could not be started. Check the address and provider configuration.",
          );
        return privateJson({ success: true, pendingConfirmation: true });
      }
      const change = await client.auth.updateUser({ password: nextPassword });
      if (change.error)
        throw new AdminError(
          "Password change failed. Check the password requirements.",
        );
      await client.auth.signOut({ scope: "global" });
      return privateJson({ success: true, signedOut: true });
    }
    throw new AdminError("Unknown account action.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return privateJson(
        { error: "Check the account fields and try again." },
        400,
      );
    return adminFailure(e);
  }
}
