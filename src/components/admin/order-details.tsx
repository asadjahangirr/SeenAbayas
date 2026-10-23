import type { AdminRecord } from "@/lib/admin/model";
import { orderDate, orderDetails } from "@/lib/admin/orders";
import { formatGbp } from "@/lib/money";
import { OrderEmailStatus } from "./order-email-status";

const amount = (value: number | null) => value === null ? "Not recorded" : formatGbp(value);

export function OrderDetails({ record }: { record: AdminRecord }) {
  const d = orderDetails(record);
  return <div className="admin-order-details">
    <div className="admin-order-overview">
      <dl><div><dt>Payment</dt><dd>{d.paymentLabel}</dd></div><div><dt>Order placed</dt><dd>{orderDate(record.created_at)}</dd></div><div><dt>Payment verified</dt><dd>{orderDate(d.verifiedAt)}</dd></div><div><dt>Order confirmed</dt><dd>{orderDate(d.confirmedAt)}</dd></div><div><dt>Source</dt><dd>{d.source}</dd></div></dl>
      <p><strong>Stock:</strong> {d.stockLabel}</p>
      {d.isTest && <p className="admin-help">Sandbox purchases release their reservation without reducing physical stock. Do not dispatch test orders.</p>}
      <p className="admin-help">Dates use UK time. Confirmation times are recorded when the store verifies payment. Older orders may not have a recorded confirmation time.</p>
    </div>
    {record.payload.source === "stripe_checkout" && <OrderEmailStatus orderId={record.id} />}
    <div className="admin-order-columns">
      <section aria-label="Customer contact"><h3>Customer contact</h3><p>{d.contactName || "Not recorded"}</p><p>{d.email ? <a href={`mailto:${encodeURIComponent(d.email)}`}>{d.email}</a> : "Email not recorded"}</p><p>{d.phone || "Phone not provided"}</p></section>
      <section aria-label="Delivery address"><h3>Delivery address</h3>{d.address.length ? <address>{[d.recipientName, ...d.address].filter(Boolean).map((line,index) => <span key={index}>{line}</span>)}</address> : <p>Address not recorded for this order.</p>}<p className="admin-order-delivery">{d.deliveryLabel || "Delivery service not recorded"}</p></section>
    </div>
    {d.items.length ? <div className="admin-order-table-wrap" role="region" aria-label="Purchased items" tabIndex={0}><table className="admin-order-items"><caption>Purchased items · Details saved at checkout</caption><thead><tr><th scope="col">Product</th><th scope="col">Size</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead><tbody>{d.items.map((item,index) => <tr key={index}><th scope="row">{item.name}{item.design_reference && <span>{item.design_reference}</span>}</th><td>{item.size}</td><td>{item.quantity}</td><td>{formatGbp(item.unit_price_pence)}</td><td>{formatGbp(item.lineTotalPence)}</td></tr>)}</tbody></table></div> : <p className="admin-help">Item details were not recorded for this older order.</p>}
    {d.hasIncompleteItems && <p className="admin-help">Some saved item details could not be displayed. Review the source order before fulfilment.</p>}
    <dl className="admin-order-totals"><div><dt>Subtotal</dt><dd>{amount(d.subtotalPence)}</dd></div>{d.discountPence!==null&&d.discountPence>0&&<div><dt>Discount ({d.couponCode})</dt><dd>-{amount(d.discountPence)}</dd></div>}{d.couponCode&&!d.discountPence&&<div><dt>Delivery code</dt><dd>{d.couponCode}</dd></div>}<div><dt>Delivery</dt><dd>{amount(d.deliveryPence)}</dd></div><div><dt>Order total</dt><dd>{amount(d.totalPence)}</dd></div>{d.refundedPence !== null && d.refundedPence > 0 && <div><dt>Recorded refunds</dt><dd>{amount(d.refundedPence)}</dd></div>}</dl>
    {(d.sessionId || d.paymentIntent) && <details className="admin-order-references"><summary>Payment references</summary><dl>{d.sessionId && <div><dt>Stripe Checkout session</dt><dd>{d.sessionId}</dd></div>}{d.paymentIntent && <div><dt>Payment Intent</dt><dd>{d.paymentIntent}</dd></div>}</dl></details>}
  </div>;
}
