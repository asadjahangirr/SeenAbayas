import { NextResponse, type NextRequest } from "next/server";
import {
  checkoutReviewRequestSchema,
  makeCheckoutReview,
  type CheckoutFieldErrors,
} from "@/lib/checkout/model";
import { getBagState } from "@/lib/bag/server";
import { randomBytes } from "node:crypto";
import { readyPaymentMode } from "@/lib/payments/server";
import { checkoutOwnerCookie, hash, reviewFingerprint, PaymentError } from "@/lib/payments/model";
import { applyCarrierQuote } from "@/lib/shipping/checkout";
import { ShippingError } from "@/lib/shipping/settings";
import { readPaymentOrigin } from "@/lib/payments/config.mjs";
import { checkCoupon, applyCoupon } from "@/lib/coupons/server";

export const maxDuration = 60;

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

/** Review only: no payment session, personal-data storage, order or stock mutation. */
export async function POST(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.host !== request.headers.get("host") ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return reply(
        { error: "Refresh the page before reviewing your details." },
        403,
      );
  } catch {
    return reply(
      { error: "Refresh the page before reviewing your details." },
      403,
    );
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return reply({ error: "Invalid checkout request." }, 415);
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Invalid checkout request." }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) {
        await reader.cancel();
        return reply({ error: "Checkout details are too long." }, 413);
      }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply({ error: "Invalid checkout request." }, 400);
  }
  const parsed = checkoutReviewRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fields: CheckoutFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "details" && typeof issue.path[1] === "string")
        fields[issue.path[1] as keyof CheckoutFieldErrors] ??= issue.message;
    }
    return reply(
      { error: "Please check your details and bag before continuing.", fields },
      400,
    );
  }
  try {
    const { quote, document } = await getBagState(parsed.data.lines);
    if (quote.lines.some((line) => line.issue || !line.piece))
      return reply(
        {
          error:
            "Stock has changed. Review the unavailable items in your bag before continuing.",
        },
        409,
      );
    if (quote.subtotalPence < document.commerce.minimumOrderPence)
      return reply(
        { error: "Your selection is below the store's minimum order value." },
        409,
      );
    if (
      parsed.data.shippingMethod === "express" &&
      (document.policies as { delivery?: { expressAvailable?: boolean } })
        .delivery?.expressAvailable !== true
    )
      return reply(
        {
          error:
            "Express delivery is no longer available. Please choose standard delivery.",
        },
        409,
      );
    const review = makeCheckoutReview(
      document,
      quote,
      parsed.data.details,
      parsed.data.shippingMethod,
    );
    const mode = await readyPaymentMode();
    const enabled = Boolean(mode);
    const previous = request.cookies.get(checkoutOwnerCookie)?.value;
    const token = previous && /^[a-f0-9]{64}$/.test(previous) ? previous : randomBytes(32).toString("hex");
    review.mode = mode || "preview";
    review.taxStatus = mode === "live" ? "none" : "unconfirmed";
    if(parsed.data.couponCode){
      if(!mode)throw new PaymentError("Discount codes are not available in preview.",409);
      applyCoupon(review,await checkCoupon(parsed.data.couponCode,quote.subtotalPence,mode));
    }
    if (enabled && document.shipping.mode === "royal_mail_olp")
      await applyCarrierQuote(review, document, hash(token), request);
    const response = reply({
      ...review,
      paymentAvailable: enabled && review.delivery.chargePence !== null,
      ...(enabled ? { reviewFingerprint: reviewFingerprint(review) } : {}),
    });
    if (enabled) {
      // Establish ownership before any reservation; network retries can then
      // recover an order even if its session response never reaches the browser.
      response.cookies.set(checkoutOwnerCookie, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: readPaymentOrigin(process.env)?.startsWith("https:") || false,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (error) {
    return reply(
      {
        error:
          error instanceof ShippingError || error instanceof PaymentError ? error.message : "We couldn't review your selection. Your details are still here; please try again.",
      },
      error instanceof ShippingError || error instanceof PaymentError ? error.status : 503,
    );
  }
}
