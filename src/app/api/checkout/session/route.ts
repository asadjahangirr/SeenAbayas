import { NextResponse, type NextRequest } from "next/server";
import { getBagState } from "@/lib/bag/server";
import { makeCheckoutReview } from "@/lib/checkout/model";
import { readPaymentOrigin } from "@/lib/payments/config.mjs";
import { assertPaymentOrigin, readPaymentBody } from "@/lib/payments/http";
import {
  checkoutOwnerCookie,
  hash,
  paymentRequestSchema,
  PaymentError,
  reviewFingerprint,
  type PaymentOrder,
} from "@/lib/payments/model";
import { paymentRpc, requireCheckout } from "@/lib/payments/server";
import { openHostedCheckout } from "@/lib/payments/provider";
import { applyCarrierQuote } from "@/lib/shipping/checkout";
import { ShippingError } from "@/lib/shipping/settings";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const siteOrigin = readPaymentOrigin(process.env);
  let ownerToken: string | undefined;
  const reply = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
    if (ownerToken)
      response.cookies.set(checkoutOwnerCookie, ownerToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: siteOrigin?.startsWith("https:") || false,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    return response;
  };
  try {
    assertPaymentOrigin(request);
    const parsed = paymentRequestSchema.safeParse(
      await readPaymentBody(request),
    );
    if (!parsed.success)
      throw new PaymentError(
        "Review your checkout details before continuing.",
        400,
      );
    const mode = await requireCheckout();
    if (!siteOrigin || new URL(siteOrigin).host !== request.headers.get("host"))
      throw new PaymentError(
        "The checkout site address is not configured for this environment.",
      );
    const current = request.cookies.get(checkoutOwnerCookie)?.value;
    if (!current || !/^[a-f0-9]{64}$/.test(current))
      throw new PaymentError(
        "Please allow checkout cookies and review your details again.",
        409,
      );
    ownerToken = current;
    const ownerHash = hash(ownerToken);
    const data = parsed.data;
    const requestHash = hash(
      JSON.stringify({
        details: data.details,
        lines: [...data.lines].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        ),
        method: data.shippingMethod,
        review: data.reviewFingerprint,
        mode,
      }),
    );
    let order = await paymentRpc<PaymentOrder | null>("payment_get_request", {
      request_id: data.requestId,
      owner_hash: ownerHash,
      request_hash: requestHash,
    });
    if (!order) {
      const { quote, document } = await getBagState(data.lines);
      if (quote.lines.some((line) => line.issue || !line.piece))
        throw new PaymentError(
          "Stock has changed. Review your bag before continuing.",
          409,
        );
      let review: ReturnType<typeof makeCheckoutReview>;
      try {
        review = makeCheckoutReview(
          document,
          quote,
          data.details,
          data.shippingMethod,
        );
        review.mode = mode;
        review.taxStatus = mode === "live" ? "none" : "unconfirmed";
      } catch {
        throw new PaymentError(
          "Store settings changed. Please review your selection again.",
          409,
        );
      }
      let carrier: Awaited<ReturnType<typeof applyCarrierQuote>> | undefined;
      if (document.shipping.mode === "royal_mail_olp") {
        if (!data.shippingQuote) throw new ShippingError("Please review your delivery charge again.", 409);
        carrier = await applyCarrierQuote(review, document, ownerHash, request, data.shippingQuote);
      } else if (data.shippingQuote) throw new ShippingError("Delivery settings changed. Please review again.", 409);
      if (reviewFingerprint(review) !== data.reviewFingerprint)
        throw new PaymentError(
          "Prices or delivery details changed. Review your selection again.",
          409,
        );
      if (review.delivery.chargePence === null)
        throw new PaymentError(
          "Delivery charges must be confirmed before this selection can proceed to payment.",
          409,
        );
      order = await paymentRpc<PaymentOrder>(carrier ? "payment_prepare_order_v3" : mode === "live" ? "payment_prepare_order_v2" : "payment_prepare_order", {
        request_id: data.requestId,
        owner_hash: ownerHash,
        request_hash: requestHash,
        details: data.details,
        requested_lines: quote.lines.map((line) => ({
          variant_id: line.variantId,
          quantity: line.quantity,
          unit_price_pence: line.piece!.pricePence,
        })),
        shipping_method: data.shippingMethod,
        expected_delivery: review.delivery.chargePence,
        return_origin: siteOrigin,
        ...(mode === "live" || carrier ? {payment_mode: mode} : {}),
        ...(carrier ? { quoted_delivery: carrier.delivery, expected_shipping: carrier.settings, expected_commerce: document.commerce } : {}),
      });
    }
    if (["expired", "failed"].includes(order.state))
      throw new PaymentError(
        "This checkout has ended. Review your selection to start a new checkout.",
        409,
      );
    const result = await openHostedCheckout(order);
    return reply({ url: result.url, orderId: result.order.id, isTest: result.order.is_test });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof PaymentError || error instanceof ShippingError
            ? error.message
            : "We couldn't open payment. Your bag is saved; retry to recover the same checkout.",
      },
      error instanceof PaymentError || error instanceof ShippingError ? error.status : 503,
    );
  }
}
