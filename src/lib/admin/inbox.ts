import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ContactDeliveryError, type ContactRequest } from "@/lib/contact/model";
import { contactRateIdentities } from "@/lib/contact/network";
import { environment } from "@/lib/environment";
export async function storeVerifiedEnquiry(data: ContactRequest, required = false, request?: Request) {
  // Optional until the owner configures the server integration. The normal
  // Resend delivery flow continues without it.
  if (!required && process.env.CONTACT_INBOX_ENABLED !== "true") return;
  const url = environment.catalog.supabase?.url;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Inbox integration is unavailable.");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
    },
  });
  const identities = required && request ? contactRateIdentities(request, key, data.email) : null;
  if (required && !identities) throw new Error("Inbox integration is unavailable.");
  const { data: result, error } = await client.rpc(required ? "submit_contact_enquiry" : "record_verified_enquiry", {
    request_id: data.requestId,
    message: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
      submittedAt: data.submittedAt,
    },
    ...(identities ? { network_hash: identities.networkHash, sender_hash: identities.senderHash } : {}),
  });
  if (error?.code === "P0001" && error.message === "Contact rate limit exceeded") throw new ContactDeliveryError("Please wait a little before sending another message, or email our team directly.", 429);
  if (error?.code === "P0001" && error.message === "Contact reference changed") throw new ContactDeliveryError("Please refresh the form before sending a changed message.", 409);
  if (error) throw new Error("Inbox integration is unavailable.");
  if (required && result?.accepted !== true) throw new Error("Inbox integration is unavailable.");
}
