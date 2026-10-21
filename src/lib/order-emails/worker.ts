import { z } from "zod";
import { emailPurchaseSchema, type EmailClaim, type EmailMessage, type OrderEmailConfig } from "./model";
import { renderOrderEmail } from "./template";

export type EmailRpc = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;

/** No dependency on Stripe responses or browser input: consumes the private outbox only. */
export async function processOrderEmails(config: OrderEmailConfig, rpc: EmailRpc, targetOrder?: string, fetcher: typeof fetch = fetch) {
  const claims = await rpc<EmailClaim[]>("order_email_claim", { target_order: targetOrder || null, batch_size: 2, payment_mode: config.mode });
  const results = await Promise.allSettled(claims.map(async claim => {
    const finish = (outcome: string, providerId?: string) => rpc<boolean>("order_email_finish", {
      email_id: claim.id, claim: claim.claim_token, outcome, provider_id: providerId || null,
    });
    const parsed = emailPurchaseSchema.safeParse(claim.snapshot);
    if (!parsed.success) { await finish("invalid"); return "review"; }
    if (parsed.data.is_test && !config.testRecipient) { await finish("suppressed"); return "suppressed"; }
    const message = await rpc<EmailMessage>("order_email_freeze", {
      email_id: claim.id, claim: claim.claim_token,
      message: claim.message || renderOrderEmail(parsed.data, claim.kind, config),
    });
    let response: Response;
    try {
      response = await fetcher("https://api.resend.com/emails", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `seen-order-email-v1/${claim.id}` },
        body: JSON.stringify(message),
      });
    } catch { await finish("retry"); return "retry"; }
    if (!response.ok) {
      // Never store provider error bodies: they can contain recipient details.
      const permanent = [400, 409, 413, 422].includes(response.status);
      await finish(permanent ? "rejected" : "retry");
      return permanent ? "review" : "retry";
    }
    let id: string | undefined;
    try {
      const body = await response.json();
      const result = z.object({ id: z.uuid() }).safeParse(body);
      if (result.success) id = result.data.id;
    } catch { /* Unknown acceptance: retry the identical idempotent request. */ }
    if (!id) { await finish("retry"); return "retry"; }
    // If this acknowledgement fails, leave/reclaim the lease and replay the
    // same request/key. The provider can return its original accepted ID.
    if (!await finish("accepted", id)) throw new Error("Email acknowledgement requires another attempt");
    return "accepted";
  }));
  return {
    checked: claims.length,
    accepted: results.filter(r => r.status === "fulfilled" && r.value === "accepted").length,
    suppressed: results.filter(r => r.status === "fulfilled" && r.value === "suppressed").length,
    review: results.filter(r => r.status === "fulfilled" && r.value === "review").length,
    retryRequired: results.filter(r => r.status === "rejected" || r.value === "retry").length,
  };
}
