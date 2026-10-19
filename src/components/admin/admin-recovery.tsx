"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
async function account(body: unknown) {
  const r = await fetch("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
export function AdminRecovery() {
  const [stage, setStage] = useState("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has("error"))
      setError(
        "This link is invalid, expired or opened in a different browser. Request a new link below.",
      );
    if (query.get("stage") === "password") {
      setStage("password");
      void fetch("/api/admin/auth", { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setFactor(d.factors[0]?.id || "");
        })
        .catch((e) => setError(e.message));
    }
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (stage === "request") {
        await account({ action: "recover-request", email });
        setMessage(
          "If this address is registered and email delivery is configured, you will receive a recovery link. Open it in this browser.",
        );
      } else if (!factor) {
        const d = await account({ action: "enroll" });
        setFactor(d.factorId);
        setQr(d.qr);
        setSecret(d.secret);
      } else {
        if (password !== confirmation)
          throw new Error("The new passwords do not match.");
        await account({
          action: "recover-password",
          password,
          code,
          factorId: factor,
        });
        setSecret("");
        setQr("");
        location.assign("/admin/login");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-login">
      <a href="/" className="admin-wordmark">
        SEEN<span>ATELIER ADMINISTRATION</span>
      </a>
      <div className="admin-login__card">
        <ShieldCheck size={28} />
        <p className="admin-eyebrow">Account recovery</p>
        <h1>
          {stage === "request" ? "A fresh start." : "Secure your access."}
        </h1>
        <p>
          {stage === "request"
            ? "Request a secure link to reset your password. Your authenticator is still required."
            : factor
              ? "Choose a new password and verify your authenticator."
              : "Set up your authenticator before choosing your new password."}
        </p>
        <form onSubmit={submit}>
          {stage === "request" ? (
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          ) : (
            <>
              {qr && (
                <div className="admin-qr">
                  <img
                    src={
                      qr.startsWith("data:")
                        ? qr
                        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`
                    }
                    alt="Scan this QR code in your authenticator"
                    width={200}
                    height={200}
                  />
                  <details>
                    <summary>Manual setup key</summary>
                    <code>{secret}</code>
                  </details>
                </div>
              )}
              {factor && (
                <>
                  <label>
                    New password
                    <input
                      type="password"
                      minLength={14}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      type="password"
                      minLength={14}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </label>
                  <label>
                    Authenticator code
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="admin-success">
              {message}
            </p>
          )}
          <button className="admin-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : stage === "request"
                ? "Request recovery link"
                : factor
                  ? "Reset password securely"
                  : "Set up authenticator"}
          </button>
        </form>
        <a href="/admin/login">Return to sign in</a>
        <p className="admin-caption">
          Lost your authenticator too? Contact your Supabase project owner for
          identity-verified recovery.
        </p>
      </div>
    </div>
  );
}
