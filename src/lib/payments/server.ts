import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { readPaymentCredentials, checkoutPaymentMode } from "./config.mjs";
import { PaymentError, type PaymentOrder } from "./model";

export function paymentServices(isTest?: boolean) {
  const config = readPaymentCredentials(process.env, isTest === undefined ? undefined : isTest ? "test" : "live");
  if (!config)
    throw new PaymentError(
      "Payments are not configured yet. Your bag is still saved.",
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
      if (error.message === "Delivery quote rate limit exceeded")
        throw new PaymentError("Too many delivery checks. Please wait a minute and try again.", 429);
      const allowed = [
        "Stock changed",
        "Prices changed",
        "Delivery charges changed",
        "Delivery charge is not configured",
        "A selected size",
        "Finish or cancel",
        "Selection is below",
        "Delivery option is unavailable",
        "Delivery quote",
        "Delivery settings changed",
        "Delivery measurements",
        "Delivery service changed",
        "Discount code",
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

export const readyPaymentMode = cache(async (): Promise<"test" | "live" | null> => {
  const mode = checkoutPaymentMode(process.env);
  if (!mode) return null;
  try {
    const data = await paymentRpc<{ ready: boolean; live_payments_ready?: boolean }>("payment_health");
    return data?.ready === true && (mode === "test" || data.live_payments_ready === true) ? mode : null;
  } catch {
    return null;
  }
});
export const paymentReadiness = cache(async () => Boolean(await readyPaymentMode()));
export async function requireCheckout() {
  const mode = await readyPaymentMode();
  if (!mode)
    throw new PaymentError("The payment database update is not ready yet.");
  return mode;
}
export async function getPaymentOrder(id: string, ownerHash?: string) {
  return paymentRpc<PaymentOrder | null>("payment_get_order", {
    order_id: id,
    owner_hash: ownerHash || null,
  });
}
