import { z } from "zod";
import { csvCell, type AdminRecord } from "./model";

const itemSchema = z.object({
  name: z.string().min(1).max(150),
  size: z.string().min(1).max(50),
  quantity: z.number().int().min(1).max(10),
  unit_price_pence: z.number().int().positive(),
  design_reference: z.string().optional(),
});
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === "string" ? v : "";
const money = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;

/** Legacy imported records remain readable without inventing missing details. */
export function orderDetails(record: AdminRecord) {
  const p = record.payload;
  const address = object(p.address), delivery = object(p.delivery);
  const items = (Array.isArray(p.items) ? p.items : []).flatMap(value => {
    const parsed = itemSchema.safeParse(value);
    return parsed.success ? [{ ...parsed.data, lineTotalPence: parsed.data.quantity * parsed.data.unit_price_pence }] : [];
  });
  return {
    number: text(p.order_number) || record.id.slice(0, 8),
    contactName: [text(address.firstName), text(address.lastName)].filter(Boolean).join(" ") || text(p.name),
    recipientName: text(address.recipientName) || text(p.name),
    email: text(p.email), phone: text(p.phone),
    address: [text(address.addressLine1), text(address.addressLine2), text(address.city), text(address.postcode), text(address.country) === "GB" ? "United Kingdom" : text(address.country)].filter(Boolean),
    items, hasIncompleteItems: Array.isArray(p.items) && items.length !== p.items.length,
    subtotalPence: money(p.subtotal_pence), deliveryPence: money(p.delivery_pence),
    totalPence: money(p.total_pence), refundedPence: money(p.refunded_pence),
    deliveryLabel: [text(delivery.carrier), text(delivery.label) || text(p.delivery_method)].filter(Boolean).join(" · "),
    isTest: p.is_test === true, source: p.source === "stripe_checkout" ? "Stripe Checkout" : "Recorded order",
    checkoutState: text(p.checkout_state), paymentStatus: text(p.payment_status),
    paymentLabel: p.needs_attention === true ? "Paid · Needs review" : p.payment_status === "paid" ? "Paid" : p.checkout_state === "pending" ? "Awaiting payment confirmation" : p.payment_status === "expired" ? "Expired" : p.payment_status === "failed" ? "Failed" : "Awaiting payment",
    verifiedAt: text(p.payment_verified_at), confirmedAt: text(p.confirmed_at),
    stockLabel: p.stock_state === "reserved" ? (p.needs_attention === true ? "Held · Needs review" : "Reserved for checkout") : p.stock_state === "committed" ? "Deducted from stock" : p.stock_state === "released" ? (p.is_test === true && p.payment_status === "paid" ? "Test reservation released" : "Reservation released") : p.stock_state === "attention" ? "Needs stock review" : "Not recorded",
    sessionId: text(p.stripe_session_id), paymentIntent: text(p.payment_intent),
  };
}

export function orderDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString("en-GB", {
    timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short",
  });
}

/** One row per purchased size; order totals repeat and must not be summed as lines. */
export function orderCsv(records: AdminRecord[]) {
  const rows: unknown[][] = [["Order", "Created (UTC)", "Confirmed (UTC)", "Environment", "Customer", "Email", "Phone", "Delivery address", "Product", "Design", "Size", "Quantity", "Unit GBP pence", "Line GBP pence", "Order GBP pence", "Delivery GBP pence", "Payment status", "Fulfilment status", "Tracking"]];
  for (const record of records) {
    const d = orderDetails(record);
    for (const item of d.items.length ? d.items : [null]) rows.push([
      d.number, record.created_at, d.confirmedAt, d.isTest ? "Test" : "Customer",
      d.contactName, d.email, d.phone, [d.recipientName, ...d.address].join(", "),
      item?.name, item?.design_reference, item?.size, item?.quantity,
      item?.unit_price_pence, item?.lineTotalPence, d.totalPence, d.deliveryPence,
      d.paymentLabel, record.payload.status, record.payload.tracking,
    ]);
  }
  return "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
