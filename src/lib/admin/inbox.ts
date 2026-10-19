import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { ContactRequest } from "@/lib/contact/model";
import { environment } from "@/lib/environment";
export async function storeVerifiedEnquiry(data: ContactRequest) {
  // Optional until the owner configures the server integration. The normal
  // Resend delivery flow continues without it.
  if (process.env.CONTACT_INBOX_ENABLED !== "true") return;
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
  const { error } = await client.rpc("record_verified_enquiry", {
    request_id: data.requestId,
    message: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: data.message,
      submittedAt: data.submittedAt,
    },
  });
  if (error) throw new Error("Inbox integration is unavailable.");
}
