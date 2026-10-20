export function isSupabaseServerKey(value) {
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(value || "")) return true;
  try {
    const parts = value.split(".");
    return parts.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === "service_role";
  } catch { return false; }
}

/** Server-only values: callers must not serialize this result into page props. */
export function readPaymentCredentials(values) {
  const stripeKey = values.STRIPE_SECRET_KEY || "";
  const supabaseKey = values.SUPABASE_SECRET_KEY || "";
  const webhookSecret = values.STRIPE_WEBHOOK_SECRET || "";
  const supabaseUrl = values.NEXT_PUBLIC_SUPABASE_URL || "";
  if (
    !/^(sk|rk)_test_[A-Za-z0-9_]+$/.test(stripeKey) ||
    !isSupabaseServerKey(supabaseKey) ||
    !/^whsec_[A-Za-z0-9_]+$/.test(webhookSecret)
  )
    return null;
  try {
    const url = new URL(supabaseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null;
    const fixtureOrigin = values.PAYMENTS_FIXTURE_ORIGIN;
    // A local simulator must never receive real keys or a hosted database.
    if (
      fixtureOrigin &&
      !(
        fixtureOrigin === "http://127.0.0.1:3108" &&
        supabaseUrl === "http://127.0.0.1:3106" &&
        stripeKey === "sk_test_SEEN_LOCAL_FIXTURE_ONLY" &&
        supabaseKey === "sb_secret_SEEN_LOCAL_FIXTURE_ONLY" &&
        webhookSecret === "whsec_SEEN_LOCAL_FIXTURE_ONLY"
      )
    )
      return null;
    return {
      stripeKey,
      supabaseKey,
      webhookSecret,
      supabaseUrl,
      fixtureOrigin,
    };
  } catch {
    return null;
  }
}

export function testCheckoutEnabled(values) {
  return (
    values.PAYMENTS_MODE === "test" &&
    values.CATALOG_SOURCE === "supabase" &&
    values.CMS_SOURCE === "supabase" &&
    Boolean(readPaymentCredentials(values)) &&
    Boolean(readPaymentOrigin(values))
  );
}

/** Read at request time; public Next variables may otherwise be frozen by build. */
export function readPaymentOrigin(values) {
  try {
    const url = new URL(values.NEXT_PUBLIC_SITE_URL || "");
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
