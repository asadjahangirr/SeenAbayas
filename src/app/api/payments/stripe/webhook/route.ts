import { after, NextResponse } from "next/server";
import { deliverOrderEmails } from "@/lib/order-emails/server";
import { z } from "zod";
import { readPaymentBody } from "@/lib/payments/http";
import { paymentServices, getPaymentOrder } from "@/lib/payments/server";
import { applyProviderSession } from "@/lib/payments/provider";
import { PaymentError } from "@/lib/payments/model";
import type Stripe from "stripe";

export const maxDuration = 60;
const supported = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return reply({ error: "Missing payment signature." }, 400);
    const raw = await readPaymentBody(request, 262144, true);
    let verified: { event: Stripe.Event; stripe: Stripe } | undefined;
    for (const isTest of [true, false]) {
      try {
        const {stripe,config} = paymentServices(isTest);
        const event = stripe.webhooks.constructEvent(raw, signature, config.webhookSecret);
        if (event.livemode === !isTest) { verified = {event,stripe}; break; }
      } catch { /* Try only the separately configured environment's signature. */ }
    }
    if (!verified) return reply({ error: "Invalid payment signature." }, 400);
    const {event,stripe} = verified;
    if (!supported.has(event.type)) return reply({ received: true });
    const reference = event.data.object as {
      id: string;
      metadata?: { order_id?: string };
    };
    const orderId = z.uuid().safeParse(reference.metadata?.order_id);
    if (!orderId.success) return reply({ received: true });
    const order = await getPaymentOrder(orderId.data);
    if (!order) return reply({ received: true });
    // Re-read Stripe to avoid trusting stale, reordered event snapshots.
    const session = await stripe.checkout.sessions.retrieve(reference.id);
    const updated = await applyProviderSession(order, session, event.id, event.type);
    if (updated.state === "paid") after(async () => { await deliverOrderEmails(updated.id, updated.is_test); });
    return reply({ received: true });
  } catch (error) {
    return reply(
      { error: "Payment verification will be retried." },
      error instanceof PaymentError && error.status === 413 ? 413 : 503,
    );
  }
}
