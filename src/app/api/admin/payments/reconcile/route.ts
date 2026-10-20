import { NextResponse } from "next/server";
import { requireAdmin, checkOrigin, AdminError } from "@/lib/admin/auth";
import { reconcilePayments } from "@/lib/payments/reconcile";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const access = await requireAdmin();
    if (access.role !== "owner")
      return NextResponse.json(
        { error: "Owner access is required." },
        { status: 403 },
      );
    return NextResponse.json(await reconcilePayments(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AdminError
            ? error.message
            : "Payment reconciliation is unavailable. Check setup and try again.",
      },
      {
        status: error instanceof AdminError ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
