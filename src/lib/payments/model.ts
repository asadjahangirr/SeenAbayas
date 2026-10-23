import { createHash } from "node:crypto";
import { z } from "zod";
import {
  checkoutReviewRequestSchema,
  type CheckoutDetails,
  type CheckoutReview,
} from "@/lib/checkout/model";

export const paymentRequestSchema = checkoutReviewRequestSchema
  .extend({
    requestId: z.uuid(),
    reviewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    shippingQuote: z.string().max(8192).optional(),
  })
  .strict();
export const cancelPaymentSchema = z.object({ orderId: z.uuid() }).strict();
export const checkoutOwnerCookie = "seen_checkout_owner";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function reviewFingerprint(review: CheckoutReview) {
  return hash(
    JSON.stringify({
      mode: review.mode,
      taxStatus: review.taxStatus,
      details: review.details,
      lines: review.bag.lines
        .map((line) => ({
          id: line.variantId,
          quantity: line.quantity,
          price: line.piece?.pricePence,
          name: line.piece?.name,
          size: line.piece?.size,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      delivery: review.delivery,
      subtotal: review.bag.subtotalPence,
      total: review.estimatedTotalPence,
      shippingQuote: review.shippingQuote,
      ...(review.coupon ? {coupon:review.coupon,discountPence:review.discountPence} : {}),
    }),
  );
}

export type PaymentItem = {
  product_id: string;
  variant_id: string;
  design_reference: string;
  name: string;
  size: string;
  quantity: number;
  unit_price_pence: number;
  photo: { src: string; alt: string; label?: string } | null;
};
export type PaymentOrder = {
  id: string;
  request_id: string;
  owner_hash: string;
  request_hash: string;
  order_number: string;
  is_test: boolean;
  state:
    | "creating"
    | "open"
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "attention";
  stock_state: "reserved" | "released" | "committed" | "attention";
  details: CheckoutDetails & { recipientName?: string };
  delivery: {
    id: "standard" | "express";
    label: string;
    carrier: string;
    chargePence: number;
  };
  subtotal_pence: number;
  discount_pence?: number;
  coupon?: import("@/lib/coupons/model").CheckoutCoupon | null;
  delivery_pence: number;
  total_pence: number;
  refunded_pence: number;
  tax_pence?: number;
  currency: "gbp";
  return_origin: string;
  session_id: string | null;
  checkout_url: string | null;
  payment_intent: string | null;
  payment_verified_at?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  expires_at: string;
  items: PaymentItem[];
};

/** Deliberately omit capability hashes, request identifiers and provider URLs. */
export function customerOrder(order: PaymentOrder) {
  return {
    id: order.id,
    number: order.order_number,
    state: order.state,
    isTest: order.is_test,
    details: order.details,
    delivery: order.delivery,
    items: order.items,
    subtotalPence: order.subtotal_pence,
    discountPence: order.discount_pence || 0,
    coupon: order.coupon || null,
    deliveryPence: order.delivery_pence,
    totalPence: order.total_pence,
    currency: "GBP" as const,
    refundedPence: order.refunded_pence,
    taxPence: order.tax_pence || 0,
    canCancel: order.state === "open" || order.state === "creating",
  };
}
export type CustomerOrder = ReturnType<typeof customerOrder>;

export class PaymentError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
