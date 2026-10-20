import "server-only";
import type Stripe from "stripe";
import { checkoutDetailsSchema } from "@/lib/checkout/model";
import { paymentServices, paymentRpc, getPaymentOrder } from "./server";
import { PaymentError, type PaymentOrder } from "./model";

export function providerSnapshot(
  order: PaymentOrder,
  session: Stripe.Checkout.Session,
  eventType = "reconcile",
) {
  if (
    session.livemode ||
    session.mode !== "payment" ||
    session.metadata?.order_id !== order.id ||
    session.client_reference_id !== order.id ||
    session.metadata?.request_hash !== order.request_hash ||
    session.currency !== "gbp" ||
    session.amount_total !== order.total_pence ||
    session.total_details?.amount_discount ||
    session.total_details?.amount_tax
  )
    throw new PaymentError(
      "Stripe payment does not match the reserved order.",
      409,
    );
  const state =
    session.payment_status === "paid"
      ? "paid"
      : session.status === "expired"
        ? "expired"
        : eventType === "checkout.session.async_payment_failed"
          ? "failed"
          : session.status === "complete"
            ? "pending"
            : "open";
  const shipping = session.collected_information?.shipping_details;
  let deliveryVerified = Boolean(shipping) || state !== "paid";
  let details = order.details;
  if (shipping) {
    // Remove the optional stored recipient key before strict address validation.
    const { recipientName: _previous, ...base } = order.details;
    const address = checkoutDetailsSchema.safeParse({
      ...base,
      email: session.customer_details?.email ?? base.email,
      phone: session.customer_details?.phone ?? base.phone,
      addressLine1: shipping.address?.line1 || "",
      addressLine2: shipping.address?.line2 || "",
      city: shipping.address?.city || "",
      postcode: shipping.address?.postal_code || "",
      country: shipping.address?.country || "",
    });
    deliveryVerified =
      address.success &&
      Boolean(shipping.name?.trim()) &&
      (shipping.name?.length || 0) <= 150;
    if (address.success && deliveryVerified)
      details = { ...address.data, recipientName: shipping.name!.trim() };
  }
  const url = session.url;
  if (url) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "checkout.stripe.com"
    )
      throw new PaymentError("Unexpected payment-page address.");
  }
  return {
    id: session.id,
    order_id: order.id,
    request_hash: order.request_hash,
    total_pence: session.amount_total,
    currency: session.currency,
    is_test: !session.livemode,
    state,
    payment_intent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
    checkout_url: url || null,
    delivery_verified: deliveryVerified,
    details,
  };
}

export async function applyProviderSession(
  order: PaymentOrder,
  session: Stripe.Checkout.Session,
  eventId?: string,
  eventType = "reconcile",
) {
  const snapshot = providerSnapshot(order, session, eventType);
  return paymentRpc<PaymentOrder>("payment_apply_session", {
    order_id: order.id,
    event_id:
      eventId ||
      `sync:${session.id}:${snapshot.state}:${session.payment_status}`,
    event_type: eventType,
    session: snapshot,
  });
}

/** Exhaust the bounded creation window before treating a missing session as an orphan. */
export async function recoverCreatingOrder(order: PaymentOrder) {
  const { stripe } = paymentServices();
  const deadline = Date.now() + 25_000;
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    if (Date.now() >= deadline) break;
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      created: {
        gte: Math.floor(Date.parse(order.created_at) / 1000) - 60,
        lte: Math.floor(Date.parse(order.expires_at) / 1000),
      },
      ...(after ? { starting_after: after } : {}),
    });
    const found = sessions.data.find(
      (session) => session.metadata?.order_id === order.id,
    );
    if (found) return applyProviderSession(order, found);
    if (!sessions.has_more) {
      if (Date.now() > Date.parse(order.expires_at) + 10 * 60_000) {
        await paymentRpc("payment_release_orphan", { order_id: order.id });
        return (await getPaymentOrder(order.id))!;
      }
      return order;
    }
    after = sessions.data.at(-1)?.id;
    if (!after) break;
  }
  throw new PaymentError("Payment reconciliation needs another attempt.");
}

export async function reconcileOrder(order: PaymentOrder) {
  if (["paid", "expired", "failed", "attention"].includes(order.state))
    return order;
  if (!order.session_id) return recoverCreatingOrder(order);
  const session = await paymentServices().stripe.checkout.sessions.retrieve(
    order.session_id,
  );
  // Time alone never releases stock. If a provider still reports an overdue
  // session as open, explicitly expire it and use the verified returned state.
  if (
    session.status === "open" &&
    Date.now() >= Date.parse(order.expires_at)
  ) {
    try {
      const expired = await paymentServices().stripe.checkout.sessions.expire(
        session.id,
      );
      return applyProviderSession(order, expired);
    } catch {
      // Payment may have won the race with expiry. Retrieve again rather than
      // assuming cancellation, so pending/paid stock is never released early.
      const latest = await paymentServices().stripe.checkout.sessions.retrieve(
        session.id,
      );
      if (latest.status === "open")
        throw new PaymentError("Checkout expiry needs another attempt.");
      return applyProviderSession(order, latest);
    }
  }
  return applyProviderSession(order, session);
}

export async function openHostedCheckout(order: PaymentOrder) {
  const { stripe } = paymentServices();
  let session: Stripe.Checkout.Session;
  if (order.session_id)
    session = await stripe.checkout.sessions.retrieve(order.session_id);
  else {
    if (Date.parse(order.expires_at) - Date.now() < 31 * 60_000) {
      const recovered = await recoverCreatingOrder(order);
      if (recovered.session_id) return openHostedCheckout(recovered);
      throw new PaymentError(
        "This checkout can no longer be opened. Return to your bag and review a new selection.",
        409,
      );
    }
    const address = {
      line1: order.details.addressLine1,
      line2: order.details.addressLine2 || undefined,
      city: order.details.city,
      postal_code: order.details.postcode,
      country: "GB",
    };
    const name = `${order.details.firstName} ${order.details.lastName}`;
    const customer = await stripe.customers.create(
      {
        email: order.details.email,
        name,
        phone: order.details.phone || undefined,
        address,
        shipping: { name, address, phone: order.details.phone || undefined },
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `seen-customer-${order.id}` },
    );
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "hosted_page",
        customer: customer.id,
        customer_update: { shipping: "auto" },
        client_reference_id: order.id,
        metadata: { order_id: order.id, request_hash: order.request_hash },
        payment_intent_data: {
          metadata: { order_id: order.id, request_hash: order.request_hash },
        },
        allowed_payment_method_types: ["card", "klarna", "afterpay_clearpay"],
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "gbp",
            unit_amount: item.unit_price_pence,
            product_data: {
              name: `${item.name} - Size ${item.size}`,
              metadata: {
                variant_id: item.variant_id,
                design_reference: item.design_reference,
              },
            },
          },
        })),
        shipping_address_collection: { allowed_countries: ["GB"] },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: order.delivery_pence, currency: "gbp" },
              display_name: `Royal Mail - ${order.delivery.label}`,
            },
          },
        ],
        automatic_tax: { enabled: false },
        allow_promotion_codes: false,
        adaptive_pricing: { enabled: false },
        expires_at: Math.floor(Date.parse(order.expires_at) / 1000),
        locale: "en-GB",
        success_url: `${order.return_origin}/order-confirmation?order=${order.id}`,
        cancel_url: `${order.return_origin}/order-confirmation?order=${order.id}&cancelled=1`,
      },
      { idempotencyKey: `seen-session-${order.id}` },
    );
  }
  const updated = await applyProviderSession(order, session);
  if (
    updated.state === "paid" ||
    updated.state === "pending" ||
    updated.state === "attention"
  )
    return { url: `/order-confirmation?order=${order.id}`, order: updated };
  if (updated.state !== "open" || !session.url)
    throw new PaymentError(
      "This checkout has ended. Return to your bag to start again.",
      409,
    );
  return { url: session.url, order: updated };
}

export async function cancelHostedCheckout(order: PaymentOrder) {
  let current = await reconcileOrder(order);
  if (current.state === "open" && current.session_id) {
    try {
      const session = await paymentServices().stripe.checkout.sessions.expire(
        current.session_id,
      );
      current = await applyProviderSession(current, session);
    } catch {
      current = await reconcileOrder(current);
    }
  }
  if (
    !["failed", "expired", "paid", "pending", "attention"].includes(
      current.state,
    )
  )
    throw new PaymentError(
      "We couldn't confirm cancellation yet. Your reservation is retained until Stripe confirms its state.",
    );
  return current;
}
