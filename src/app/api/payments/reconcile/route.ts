import { NextResponse } from "next/server";
import { reconcilePayments } from "@/lib/payments/reconcile";
import { recoveryAuthorised } from "@/lib/payments/recovery-auth";
import { deliverOrderEmails } from "@/lib/order-emails/server";

export const maxDuration = 60;
export async function GET(request: Request) {
  if (
    !recoveryAuthorised(request.headers, request.method, process.env.PAYMENTS_RECONCILE_SECRET)
  )
    return NextResponse.json(
      { error: "Unauthorised." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    const [payments, emails] = await Promise.allSettled([reconcilePayments(), deliverOrderEmails()]);
    if (payments.status === "rejected") throw payments.reason;
    const result = payments.value;
    return NextResponse.json({ ...result, emails: emails.status === "fulfilled" ? emails.value : { retryRequired: 1 } }, {
      status: result.retryRequired ? 503 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Reconciliation will need another attempt." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

// Supabase Cron/pg_net supports authenticated HTTP POST as well as GET.
// Both entry points require server authentication; timestamped signatures are POST-only.
export const POST = GET;
