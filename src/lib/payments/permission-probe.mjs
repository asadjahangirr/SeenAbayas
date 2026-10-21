/** Read access only. Never call a create/update/expire/refund endpoint here. */
export async function probeStripeReadAccess(stripe) {
  const options = { timeout: 8000, maxNetworkRetries: 0 };
  // Future-only lists check access without requesting existing customer/session data.
  const params = { limit: 1, created: { gte: Math.floor(Date.now() / 1000) + 86400 } };
  const failure = error => {
    if (error?.statusCode === 401 || error?.type === "StripeAuthenticationError") return "authentication_failed";
    if (error?.statusCode === 403 || error?.type === "StripePermissionError") return "permission_denied";
    if (error?.statusCode === 429) return "rate_limited";
    return "unavailable";
  };
  const read = async task => {
    try { await task(); return "passed"; }
    catch (error) { return failure(error); }
  };
  const [checkoutSessionsRead, customersRead, account] = await Promise.all([
    read(() => stripe.checkout.sessions.list(params, options)),
    read(() => stripe.customers.list(params, options)),
    (async () => {
      try {
        const data = await stripe.accounts.retrieveCurrent({}, options);
        return {
          status: "passed",
          chargesEnabled: typeof data.charges_enabled === "boolean" ? data.charges_enabled : null,
          payoutsEnabled: typeof data.payouts_enabled === "boolean" ? data.payouts_enabled : null,
        };
      } catch (error) {
        return { status: failure(error), chargesEnabled: null, payoutsEnabled: null };
      }
    })(),
  ]);
  return {
    requiredReadAccess: checkoutSessionsRead === "passed" && customersRead === "passed" ? "passed" : "failed",
    checkoutSessionsRead,
    customersRead,
    account,
    writePermissions: "not_tested",
    webhookDelivery: "not_tested",
    paymentMethodEligibility: "not_tested",
  };
}
