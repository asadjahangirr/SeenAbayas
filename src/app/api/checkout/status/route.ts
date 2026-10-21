import { after, NextResponse, type NextRequest } from "next/server";
import { deliverOrderEmails } from "@/lib/order-emails/server";
import { z } from "zod";
import {
  checkoutOwnerCookie,
  customerOrder,
  hash,
  PaymentError,
} from "@/lib/payments/model";
import { getPaymentOrder } from "@/lib/payments/server";
import { reconcileOrder } from "@/lib/payments/provider";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("order"));
  const token = request.cookies.get(checkoutOwnerCookie)?.value;
  if (!id.success || !token || !/^[a-f0-9]{64}$/.test(token))
    return reply(
      {
        error:
          "This checkout is unavailable in this browser. Return to your bag or contact customer care.",
      },
      404,
    );
  try {
    let order = await getPaymentOrder(id.data, hash(token));
    if (!order)
      return reply(
        { error: "This checkout is unavailable in this browser." },
        404,
      );
    let checking = false;
    try {
      order = await reconcileOrder(order);
    } catch {
      checking = true;
    }
    if (order.state === "paid") {
      const paidId = order.id;
      const isTest = order.is_test;
      after(async () => { await deliverOrderEmails(paidId, isTest); });
    }
    return reply({ order: customerOrder(order), checking });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof PaymentError
            ? error.message
            : "We couldn't check this payment. Please try again shortly.",
      },
      503,
    );
  }
}
