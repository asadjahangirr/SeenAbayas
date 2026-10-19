"use client";
import { useState, type FormEvent } from "react";
export function ChangeEmail() {
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const status = await fetch("/api/admin/auth", { cache: "no-store" });
      const data = await status.json();
      if (!status.ok) throw new Error(data.error);
      const r = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "email",
          email,
          current,
          code,
          factorId: data.factors[0]?.id,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setDone(true);
      setCurrent("");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel">
      <div className="admin-panel__heading">
        <h2>Change login email</h2>
        <p>
          Your account permissions stay attached to your user ID. Confirm the
          change using the email links sent by Supabase.
        </p>
      </div>
      <form className="admin-form-stack" onSubmit={submit}>
        <label className="admin-field">
          New login email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="admin-field">
          Current password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className="admin-field">
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
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="admin-success">
            Confirmation requested. Follow the links sent to your email
            addresses to complete the change.
          </p>
        )}
        <button className="admin-primary" disabled={busy}>
          {busy ? "Please wait…" : "Request email change"}
        </button>
      </form>
    </section>
  );
}
