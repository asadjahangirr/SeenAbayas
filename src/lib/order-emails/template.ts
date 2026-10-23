import { type EmailKind, type EmailMessage, type EmailPurchase, type OrderEmailConfig, ownerOrderInbox } from "./model";

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const gbp = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const safeLine = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, " ");

/** v1 content is frozen in the outbox before sending; subsequent retries reuse it. */
export function renderOrderEmail(order: EmailPurchase, kind: EmailKind, config: OrderEmailConfig): EmailMessage {
  const owner = kind === "owner_notification";
  const d = order.details;
  const recipient = order.is_test ? config.testRecipient : owner ? ownerOrderInbox : d.email;
  if (!recipient) throw new Error("Sandbox delivery requires an explicit test recipient");
  const name = d.recipientName || `${d.firstName} ${d.lastName}`.trim();
  const date = new Date(order.confirmed_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" });
  const title = owner ? "A new order has arrived." : "Thank you for your order.";
  const intro = owner ? "Payment has been verified. The order details below are ready to review in your dashboard." :
    "Your payment has been verified and your SEEN ABAYAS order is confirmed. Here is a copy of your order details.";
  const address = [name, d.addressLine1, d.addressLine2, d.city, d.postcode, "United Kingdom"].filter(Boolean);
  const delivery = `${order.delivery.carrier} · ${order.delivery.label}`;
  const totals = [["Subtotal", gbp(order.subtotal_pence)], ...(order.discount_pence ? [[`Discount (${order.coupon?.code||"code"})`, `-${gbp(order.discount_pence)}`]] : order.coupon?.code ? [["Delivery code",order.coupon.code]] : []), ["Delivery", order.delivery_pence ? gbp(order.delivery_pence) : "Complimentary"],
    ["Added tax", gbp(order.tax_pence)], ["Total paid", gbp(order.total_pence)]];
  const testNote = order.is_test ? "SANDBOX TEST — No real payment was taken. Do not dispatch this order. Both test messages are redirected to the configured test inbox." : "";
  const link = `${config.origin}${owner ? "/admin/orders" : "/returns-exchanges"}`;
  const linkText = owner ? "Review orders in your dashboard" : "Returns & exchanges";
  const text = ["SEEN ABAYAS", "Made to Be Seen.", testNote, title, intro, `Order: ${order.order_number}`,
    `Confirmed: ${date} (UK time)`, "Payment: Paid", "", "YOUR PIECES",
    ...order.items.map(i => `${safeLine(i.name)} (${safeLine(i.design_reference)}) | Size ${safeLine(i.size)} | Quantity ${i.quantity} | ${gbp(i.unit_price_pence)} each | ${gbp(i.quantity * i.unit_price_pence)}`),
    "", ...totals.map(([label, value]) => `${label}: ${value}`), "", "DELIVERY", ...address.map(safeLine), delivery,
    "", `Customer email: ${d.email}`, `Phone: ${d.phone || "Not provided"}`, "",
    owner ? "Open the dashboard before dispatching. This email is not a shipping label." : "This confirms your order, not dispatch. Please keep your order number when contacting us.",
    `${linkText}: ${link}`, `Questions about this order? ${ownerOrderInbox}`, `${config.origin}/shipping-delivery`,
  ].join("\n");
  const bodyRows = order.items.map(i => `<tr><td style="padding:18px 0;border-bottom:1px solid #e7e1d8"><strong>${escape(i.name)}</strong><br><span style="font-size:12px;color:#625b52">${escape(i.design_reference)} · Size ${escape(i.size)}<br>Quantity ${i.quantity} · ${gbp(i.unit_price_pence)} each</span></td><td align="right" style="padding:18px 0;border-bottom:1px solid #e7e1d8;white-space:nowrap">${gbp(i.quantity * i.unit_price_pence)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head><body style="margin:0;background:#f5f2ec;color:#211d18;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(order.order_number)} — ${escape(title)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf9"><tr><td align="center" style="padding:36px 24px;border-bottom:1px solid #e7e1d8"><span style="font-family:Georgia,serif;font-size:36px;letter-spacing:9px">SEEN</span><br><span style="font-size:10px;letter-spacing:4px">ABAYAS</span><p style="font-family:Georgia,serif;font-style:italic;color:#625b52">Made to Be Seen.</p></td></tr><tr><td style="padding:32px 24px">${testNote ? `<p style="padding:12px;background:#fff0ce;font-size:13px">${escape(testNote)}</p>` : ""}<h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400;line-height:1.2;margin:0 0 16px">${title}</h1><p style="font-size:14px;line-height:1.8;color:#625b52">${intro}</p><p style="font-size:13px;line-height:1.8"><strong>${escape(order.order_number)}</strong><br>${escape(date)} · UK time<br>Payment verified · Paid</p><table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.6"><caption style="text-align:left;padding:20px 0 4px;font-size:11px;letter-spacing:2px">YOUR PIECES</caption><thead><tr><th scope="col" align="left" style="font-size:11px;color:#625b52">Piece / size / quantity</th><th scope="col" align="right" style="font-size:11px;color:#625b52">Amount</th></tr></thead><tbody>${bodyRows}</tbody></table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 28px;font-size:14px">${totals.map(([label, value], i) => `<tr><td style="padding:8px 0;${i === 3 ? "border-top:1px solid #211d18;font-weight:bold" : "color:#625b52"}">${label}</td><td align="right" style="padding:8px 0;${i === 3 ? "border-top:1px solid #211d18;font-weight:bold" : ""}">${value}</td></tr>`).join("")}</table><h2 style="font-size:11px;letter-spacing:2px;font-weight:400">DELIVERY</h2><p style="font-size:14px;line-height:1.8">${address.map(escape).join("<br>")}</p><p style="font-size:13px;color:#625b52">${escape(delivery)}</p><p style="font-size:13px;line-height:1.8">Customer email: ${escape(d.email)}<br>Phone: ${escape(d.phone || "Not provided")}</p><p style="font-size:13px;line-height:1.8;color:#625b52">${owner ? "Open the dashboard before dispatching. This email is not a shipping label." : "This confirms your order, not dispatch. Please keep your order number when contacting us."}</p><p style="padding-top:14px"><a href="${escape(link)}" style="color:#211d18;text-underline-offset:4px;font-size:13px">${linkText}</a></p></td></tr><tr><td align="center" style="padding:24px;border-top:1px solid #e7e1d8;font-size:12px;line-height:1.8;color:#625b52">Questions about your order?<br><a href="mailto:${ownerOrderInbox}" style="color:#211d18">${ownerOrderInbox}</a><br><a href="${escape(config.origin)}/shipping-delivery" style="color:#625b52">Shipping & delivery</a></td></tr></table></td></tr></table></body></html>`;
  return {
    from: `SEEN ABAYAS <${config.from}>`, to: [recipient],
    reply_to: owner && !order.is_test ? d.email : ownerOrderInbox,
    subject: `${order.is_test ? "[TEST] " : ""}${owner ? "New paid order" : "Your SEEN ABAYAS order is confirmed"} · ${order.order_number}`,
    html, text, tags: [{ name: "order_id", value: order.id }, { name: "notification", value: kind }],
  };
}
