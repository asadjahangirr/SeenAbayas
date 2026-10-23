"use client";
import { useState } from "react";
import { CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";

const checks = [
  { name: "Customer payments", url: "/api/admin/payments/readiness", describe: (v: any) => v.readyMode === "live" ? "Live payments are configured. A genuine purchase still needs end-to-end verification." : v.readyMode === "test" ? "Test payments are configured. Customers are not being charged real money." : "Payments need setup attention from your website manager." },
  { name: "Order emails", url: "/api/admin/order-emails", describe: (v: any) => v.configured && v.ready ? "Order email sending is configured. Check delivery records on each order." : "Order emails need setup attention from your website manager." },
  { name: "Royal Mail prices", url: "/api/admin/shipping/readiness?royalMail=read", describe: (v: any) => v.connection === "passed" && v.pricingAccess === "passed" ? "Royal Mail returned priced services. Confirm your parcel measurements and delivery settings before switching to calculated prices." : v.connection === "authentication_failed" ? "Royal Mail did not accept the saved connection key. Keep fixed delivery selected and ask your website manager to check it." : "Royal Mail calculated pricing is not verified yet. Your fixed delivery settings can still be used." },
];
export function ConnectionChecks() {
  const [results, setResults] = useState<Record<string, { text: string; detail?: unknown }>>({});
  const [busy, setBusy] = useState("");
  async function check(item: typeof checks[number]) {
    setBusy(item.name);
    try {
      const response = await fetch(item.url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error("We could not check this connection. Try again or ask your website manager.");
      setResults(old => ({ ...old, [item.name]: { text: item.describe(data), detail: data } }));
    } catch (error) { setResults(old => ({ ...old, [item.name]: { text: error instanceof Error ? error.message : "Please try again." } })); }
    finally { setBusy(""); }
  }
  return <details className="admin-help admin-connection-checks"><summary>Check payments, order emails and delivery connections</summary>
    <p>These checks read setup information. They do not place orders, charge customers or buy postage.</p>
    {checks.map(item => <div key={item.name} className="admin-check-row"><strong>{item.name}</strong>
      <button disabled={Boolean(busy)} onClick={() => void check(item)}>{busy === item.name ? <LoaderCircle size={15} className="admin-spin" /> : <CheckCircle2 size={15} />}Check connection</button>
      {results[item.name] && <div role="status"><p>{results[item.name].text}</p><details><summary>Details for your website manager</summary><pre>{JSON.stringify(results[item.name].detail || {}, null, 2)}</pre></details></div>}
    </div>)}
  </details>;
}
