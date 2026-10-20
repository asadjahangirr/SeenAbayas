import "server-only";
import { paymentRpc } from "./server";
import { reconcileOrder } from "./provider";
import type { PaymentOrder } from "./model";

export async function reconcilePayments() {
  const orders = await paymentRpc<PaymentOrder[]>("payment_pending_orders", {
    batch_size: 5,
  });
  const results = await Promise.allSettled(
    orders.map((order) => reconcileOrder(order)),
  );
  return {
    checked: orders.length,
    updated: results.filter(
      (result, index) =>
        result.status === "fulfilled" &&
        result.value.state !== orders[index].state,
    ).length,
    retryRequired: results.filter((result) => result.status === "rejected")
      .length,
  };
}
