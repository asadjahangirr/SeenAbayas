import { z } from "zod";
import { createHash } from "node:crypto";
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
    email: z.email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();
const code = z.string().regex(/^\d{6}$/);
const recoveryTimes = new Map<string, number>();
export async function GET() {
  try {
    const { client, user, role, mfa } = await requireAdmin(false);
    const factors = await client.auth.mfa.listFactors();
    return privateJson({
      email: user.email,
      role,
      mfa,
      factors:
        factors.data?.totp
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
    const body = await readAdminBody(request);
    if (body.action === "login") {
      const input = login.parse(body);
      const client = await adminClient();
      const result = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (result.error)
        throw new AdminError(
          "Sign-in failed. Check your email and password.",
          401,
        );
      try {
        await requireAdmin(false);
      } catch (e) {
        await client.auth.signOut();
        throw e;
      }
      return privateJson({ success: true });
    }
    if (body.action === "recover-request") {
      const email = z.email().max(254).parse(body.email).toLowerCase();
      const emailHash = createHash("sha256").update(email).digest("hex");
      const now = Date.now();
      for (const [address, expires] of recoveryTimes)
        if (expires < now) recoveryTimes.delete(address);
      if (!recoveryTimes.has(emailHash) && recoveryTimes.size < 1000) {
        recoveryTimes.set(emailHash, now + 15 * 60 * 1000);
        const client = await adminClient();
        const origin = request.headers.get("origin")!;
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/admin/auth/callback`,
        });
      }
      // Keep account existence and provider responses private.
      return privateJson({ success: true });
    }
    const { client, mfa } = await requireAdmin(false);
    if (body.action === "logout") {
      await client.auth.signOut();
      return privateJson({ success: true });
    }
    if (body.action === "enroll") {
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
