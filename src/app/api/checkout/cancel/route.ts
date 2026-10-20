import { NextResponse, type NextRequest } from "next/server";
import { assertPaymentOrigin, readPaymentBody } from "@/lib/payments/http";
import {
  cancelPaymentSchema,
  checkoutOwnerCookie,
  hash,
  PaymentError,
  customerOrder,
} from "@/lib/payments/model";
import { getPaymentOrder } from "@/lib/payments/server";
import { cancelHostedCheckout } from "@/lib/payments/provider";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  try {
    assertPaymentOrigin(request);
    const parsed = cancelPaymentSchema.safeParse(
      await readPaymentBody(request),
    );
    const token = request.cookies.get(checkoutOwnerCookie)?.value;
    if (!parsed.success || !token || !/^[a-f0-9]{64}$/.test(token))
      throw new PaymentError(
        "This checkout is unavailable in this browser.",
        404,
      );
    const order = await getPaymentOrder(parsed.data.orderId, hash(token));
    if (!order)
      throw new PaymentError(
        "This checkout is unavailable in this browser.",
        404,
      );
    return reply({ order: customerOrder(await cancelHostedCheckout(order)) });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof PaymentError
            ? error.message
            : "We couldn't confirm cancellation yet. Please try again.",
      },
      error instanceof PaymentError ? error.status : 503,
    );
  }
}
