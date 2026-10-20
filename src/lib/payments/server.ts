import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { readPaymentCredentials, testCheckoutEnabled } from "./config.mjs";
import { PaymentError, type PaymentOrder } from "./model";

export function paymentServices() {
  const config = readPaymentCredentials(process.env);
  if (!config)
    throw new PaymentError(
      "Test payments are not configured yet. Your bag is still saved.",
    );
  const stripe = new Stripe(config.stripeKey, {
    timeout: 8000,
    maxNetworkRetries: 1,
    ...(config.fixtureOrigin
      ? { host: "127.0.0.1", port: 3108, protocol: "http" as const }
      : {}),
  });
  const db = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }),
    },
  });
  return { stripe, db, config };
}

export async function paymentRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await paymentServices().db.rpc(name, args);
  if (error) {
    if (["PGRST202", "42883"].includes(error.code))
      throw new PaymentError(
        "The payment database update has not been installed yet.",
      );
    if (error.code === "42501")
      throw new PaymentError(
        "This checkout cannot be accessed. Return to your bag and try again.",
        403,
      );
    if (error.code === "P0001") {
      const allowed = [
        "Stock changed",
        "Prices changed",
        "Delivery charges changed",
        "Delivery charge is not configured",
        "A selected size",
        "Finish or cancel",
        "Selection is below",
        "Delivery option is unavailable",
        "Checkout request does not match",
      ];
      if (allowed.some((prefix) => error.message.startsWith(prefix)))
        throw new PaymentError(error.message, 409);
    }
    throw new PaymentError(
      "We couldn't update this checkout safely. Please try again shortly.",
    );
  }
  return data as T;
}

export const paymentReadiness = cache(async () => {
  if (!testCheckoutEnabled(process.env)) return false;
  try {
    const data = await paymentRpc<{ ready: boolean }>("payment_health");
    return data?.ready === true;
  } catch {
    return false;
  }
});
export async function requireTestCheckout() {
  if (!testCheckoutEnabled(process.env))
    throw new PaymentError(
      "Test payments are not enabled yet. Your bag is still saved.",
    );
  if (!(await paymentReadiness()))
    throw new PaymentError("The payment database update is not ready yet.");
}
export async function getPaymentOrder(id: string, ownerHash?: string) {
  return paymentRpc<PaymentOrder | null>("payment_get_order", {
    order_id: id,
    owner_hash: ownerHash || null,
  });
}
