import "server-only";
import { orderEmailConfiguration } from "./model";
import { processOrderEmails } from "./worker";
import { paymentRpc } from "@/lib/payments/server";

/** Email failures never undo or misreport a verified payment. Cron retries durably. */
export async function deliverOrderEmails(targetOrder?: string, isTest?: boolean) {
  const { config } = orderEmailConfiguration(process.env);
  if (!config) return { configured: false };
  // Local/sandbox workers sharing the same Supabase project must never drain
  // genuine live-order emails using local sender settings or localhost links.
  if (config.mode === "test" && isTest === false) return { configured: true, skippedEnvironment: true };
  const modes: ("test" | "live")[] = targetOrder ? [isTest === undefined ? config.mode : isTest ? "test" : "live"] :
    config.mode === "test" ? ["test"] : ["live", "test"];
  try {
    const batches = await Promise.all(modes.map(mode => processOrderEmails({ ...config, mode }, paymentRpc, targetOrder)));
    return { configured: true, checked: batches.reduce((n, b) => n + b.checked, 0),
      accepted: batches.reduce((n, b) => n + b.accepted, 0), suppressed: batches.reduce((n, b) => n + b.suppressed, 0),
      review: batches.reduce((n, b) => n + b.review, 0), retryRequired: batches.reduce((n, b) => n + b.retryRequired, 0) };
  }
  catch { return { configured: true, retryRequired: 1 }; }
}
