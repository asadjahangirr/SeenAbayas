"use client";
import { useEffect, useRef, useState } from "react";
import type { EmailStatus } from "@/lib/order-emails/model";
import { requestDeadline } from "@/lib/request-deadline";

const labels: Record<string, string> = {
  queued: "Queued · automatic retry scheduled", sending: "Sending", accepted: "Accepted by email provider",
  review: "Needs attention · check Resend logs", suppressed: "Sandbox email skipped",
};
export function OrderEmailStatus({ orderId }: { orderId: string }) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const [data, setData] = useState<(EmailStatus & { configured: boolean; database: string }) | null>(null);
  const [error, setError] = useState(false);
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const details = section.current?.closest("details");
    if (!details) { setActive(true); return; }
    const toggle = () => setActive(details.open);
    toggle();
    details.addEventListener("toggle", toggle);
    return () => details.removeEventListener("toggle", toggle);
  }, []);
  useEffect(() => {
    if (!active) return;
    let current = true;
    const deadline = requestDeadline(10000);
    fetch(`/api/admin/order-emails?order=${encodeURIComponent(orderId)}`, { cache: "no-store", signal: deadline.signal })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(value => { if (current) { setData(value); setError(false); } })
      .catch(() => { if (current) setError(true); })
      .finally(() => deadline.dispose());
    return () => { current = false; deadline.dispose(); };
  }, [orderId, revision, active]);
  return <section ref={section} aria-label="Order emails">
    <h3>Order emails</h3>
    {error ? <p role="status">Email status is unavailable. Reload to try again.</p> : !data ? <p role="status">Checking email status…</p> : <>
      {data.database !== "ready" ? <p>The order email database is not ready. Check setup before expecting notifications.</p> : <>
        {!data.configured && <p>Automatic sending is disabled or not configured yet.</p>}
        {data.messages.length ? <ul>{data.messages.map(m => <li key={m.kind}><strong>{m.kind === "customer_confirmation" ? "Customer confirmation" : "Owner notification"}:</strong> {labels[m.state] || "Unknown"}{m.acceptedAt && ` · ${new Date(m.acceptedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} UK time`}</li>)}</ul> : <p>No confirmation emails queued. Notifications start with verified orders after the email update is installed.</p>}
        <p className="admin-help">Provider acceptance confirms submission for delivery. Check Resend for delivery, bounce or spam issues.</p>
      </>}
    </>}
    <button type="button" className="admin-inline-link" onClick={() => refresh(n => n + 1)}>Refresh email status</button>
  </section>;
}
