import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reconcilePayments } from "@/lib/payments/reconcile";

export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.PAYMENTS_RECONCILE_SECRET;
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (
    !expected ||
    expected.length < 32 ||
    !provided ||
    Buffer.byteLength(expected) !== Buffer.byteLength(provided) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  )
    return NextResponse.json(
      { error: "Unauthorised." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    return NextResponse.json(await reconcilePayments(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Reconciliation will need another attempt." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
