"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";

async function auth(action: Record<string, unknown>) {
  const r = await fetch("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [stage, setStage] = useState<"login" | "enroll" | "verify">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const r = await fetch("/api/admin/auth", { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    if (d.passwordOnly || d.mfa) {
      window.location.assign("/admin");
      return;
    }
    if (d.factors.length) {
      setFactor(d.factors[0].id);
      setStage("verify");
    } else setStage("enroll");
  }
  useEffect(() => {
    void load().catch(() => {});
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (stage === "login") {
        await auth({ action: "login", email, password });
        setPassword("");
        await load();
      } else if (stage === "enroll" && !factor) {
        const d = await auth({ action: "enroll" });
        setFactor(d.factorId);
        setQr(d.qr);
        setSecret(d.secret);
      } else {
        await auth({ action: "verify", factorId: factor, code });
        setSecret("");
        setQr("");
        window.location.assign("/admin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
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
        <ShieldCheck size={28} strokeWidth={1.2} />
        <p className="admin-eyebrow">Private workspace</p>
        <h1>
          {stage === "login"
            ? "Welcome back."
            : stage === "enroll"
              ? "Secure your account."
              : "One final check."}
        </h1>
        <p>
          {stage === "login"
            ? "Sign in to manage your collection and the details that make SEEN yours."
            : stage === "enroll"
              ? "Set up an authenticator app to protect store management."
              : "Enter the current six-digit code from your authenticator."}
        </p>
        <form onSubmit={submit}>
          {stage === "login" ? (
            <>
              <label>
                Email address or username
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={128}
                />
              </label>
            </>
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
                    <summary>Enter setup key manually</summary>
                    <code>{secret}</code>
                  </details>
                </div>
              )}
              {(stage === "verify" || factor) && (
                <label>
                  Authenticator code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          <button className="admin-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : stage === "login"
                ? "Continue securely"
                : stage === "enroll" && !factor
                  ? "Set up authenticator"
                  : "Open workspace"}
            <ArrowRight size={16} />
          </button>
        </form>
        {stage !== "login" && (
          <button
            className="admin-quiet"
            onClick={() =>
              void auth({ action: "logout" }).then(() =>
                window.location.reload(),
              )
            }
          >
            Use a different account
          </button>
        )}
        <a href="/admin/recover">Forgot your password?</a>
        <p className="admin-caption">
          Approved administrators only. Add a verified email in Account settings
          to receive password-reset links.
        </p>
      </div>
      <a href="/">Return to the store</a>
    </div>
  );
}
