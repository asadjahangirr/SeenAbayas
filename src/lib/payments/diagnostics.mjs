import { checkoutPaymentMode, isSupabaseServerKey, readPaymentCredentials, readPaymentOrigin } from "./config.mjs";

/** Only allowlisted setting names/messages leave this function; never return values.
 * @param {Record<string, string | undefined>} values
 */
export function paymentConfigurationReport(values) {
  const requestedMode = ["test", "live", "disabled"].includes(values.PAYMENTS_MODE || "")
    ? values.PAYMENTS_MODE : values.PAYMENTS_MODE ? "invalid" : "disabled";
  const configuredMode = checkoutPaymentMode(values);
  /** @type {{setting: string, message: string}[]} */
  const issues = [];
  const add = (setting, message) => issues.push({ setting, message });
  if (requestedMode !== "test" && requestedMode !== "live") {
    add("PAYMENTS_MODE", "New checkout is disabled. Use exactly test or live when intended.");
    return { requestedMode, configuredMode, issues };
  }
  for (const setting of ["CATALOG_SOURCE", "CMS_SOURCE"])
    if (values[setting] !== "supabase") add(setting, "Set to exactly supabase.");
  const origin = readPaymentOrigin(values);
  if (!origin) add("NEXT_PUBLIC_SITE_URL", "Use a valid website origin without a path, query, credentials or fragment.");
  else if (requestedMode === "live" && !origin.startsWith("https:") && !values.PAYMENTS_FIXTURE_ORIGIN)
    add("NEXT_PUBLIC_SITE_URL", "Live checkout requires an HTTPS website origin.");
  if (requestedMode === "live" && values.PAYMENTS_TAX_MODE !== "none")
    add("PAYMENTS_TAX_MODE", "Set to exactly none for the approved zero-added-tax checkout.");
  if (!isSupabaseServerKey(values.SUPABASE_SECRET_KEY))
    add("SUPABASE_SECRET_KEY", "Use the server-only secret/service-role key for the existing project.");
  try {
    const url = new URL(values.NEXT_PUBLIC_SUPABASE_URL || "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
      throw new Error();
  } catch {
    add("NEXT_PUBLIC_SUPABASE_URL", "Use the Supabase project origin, not the website or an API path.");
  }
  const primaryLive = /^(sk|rk)_live_/.test(values.STRIPE_SECRET_KEY || "");
  const modes = requestedMode === "live" ? ["live", "test"] : ["test"];
  for (const mode of modes) {
    const secondary = mode === "test" && primaryLive;
    const keySetting = secondary ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
    const signatureSetting = secondary ? "STRIPE_TEST_WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET";
    if (!new RegExp(`^(sk|rk)_${mode}_[A-Za-z0-9_]+$`).test(values[keySetting] || ""))
      add(keySetting, `Use a ${mode} server API key, without quotes or surrounding whitespace.`);
    if (!/^whsec_[A-Za-z0-9_]+$/.test(values[signatureSetting] || ""))
      add(signatureSetting, `Use the ${mode} destination signing secret, without quotes or surrounding whitespace.`);
  }
  if (requestedMode === "live" && values.STRIPE_WEBHOOK_SECRET &&
      values.STRIPE_WEBHOOK_SECRET === values.STRIPE_TEST_WEBHOOK_SECRET)
    add("STRIPE_WEBHOOK_SECRET / STRIPE_TEST_WEBHOOK_SECRET", "Live and sandbox destinations must have different signing secrets.");
  if (values.PAYMENTS_FIXTURE_ORIGIN && modes.some(mode => !readPaymentCredentials(values, mode)))
    add("PAYMENTS_FIXTURE_ORIGIN", "The isolated simulator cannot use hosted services or real credentials. Remove this setting from Production.");
  if (!configuredMode && !issues.length)
    add("PAYMENT_CONFIGURATION", "Combined configuration was rejected. Check the deployed environment and source version.");
  return { requestedMode, configuredMode, issues };
}
