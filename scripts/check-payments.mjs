// Read-only connectivity check. Never prints keys, balances or customer details.
import fs from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const result = { testKey: /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || ""), stripeConnected: false, supabaseConnected: false, paymentMigrationReady: false, webhookConfigured: /^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET || ""), paymentsMode: process.env.PAYMENTS_MODE || "disabled" };
result.configuredStripeMode = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY || "") ? "live" : result.testKey ? "test" : "unconfigured";
result.recoverySecretConfigured = (process.env.PAYMENTS_RECONCILE_SECRET || "").length >= 32 && (process.env.PAYMENTS_RECONCILE_SECRET || "").length <= 256;
if (result.configuredStripeMode !== "unconfigured") {
  try { const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 8000, maxNetworkRetries: 0 }); const balance = await stripe.balance.retrieve(); result.stripeConnected = balance.livemode === (result.configuredStripeMode === "live"); }
  catch { result.stripeConnected = false; }
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
    const state = await db.rpc("get_storefront_state"); result.supabaseConnected = !state.error;
    const health = await db.rpc("payment_health"); result.paymentMigrationReady = !health.error && health.data?.ready === true;
    result.orderRecordsReady = !health.error && health.data?.order_records_ready === true;
    result.stockManagementReady = !health.error && health.data?.stock_management_ready === true;
    result.livePaymentsReady = !health.error && health.data?.live_payments_ready === true;
    if (health.error) result.paymentDatabaseErrorCode = health.error.code;
    result.supabaseServerKeyFormat = /^sb_secret_/.test(process.env.SUPABASE_SECRET_KEY) ? "secret" : process.env.SUPABASE_SECRET_KEY.startsWith("eyJ") ? "legacy-jwt" : "other";
  } catch { /* Only report readiness, never raw provider errors. */ }
}
console.log(JSON.stringify(result, null, 2));
if (!result.stripeConnected || !result.supabaseConnected) process.exitCode = 1;
