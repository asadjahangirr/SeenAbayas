/** Explicit fixture settings prevent .env.local from enabling real integrations. */
export function isolatedEnvironment(port, overrides = {}) {
  return {
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    SITE_INDEXING_ENABLED: "false", CATALOG_SOURCE: "preview", CMS_SOURCE: "files",
    NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "",
    PAYMENTS_MODE: "disabled", PAYMENTS_TAX_MODE: "none", PAYMENTS_FIXTURE_ORIGIN: "",
    STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_TEST_SECRET_KEY: "", STRIPE_TEST_WEBHOOK_SECRET: "",
    PAYMENTS_RECONCILE_SECRET: "", RESEND_API_KEY: "", CONTACT_FROM_EMAIL: "",
    CONTACT_DELIVERY: "inbox", CONTACT_TURNSTILE_SITE_KEY: "", CONTACT_TURNSTILE_SECRET_KEY: "", CONTACT_INBOX_ENABLED: "false",
    ORDER_EMAILS_ENABLED: "false", ORDER_FROM_EMAIL: "", ORDER_EMAIL_TEST_RECIPIENT: "",
    ROYAL_MAIL_API_KEY: "", ADMIN_EMAIL_FIXTURE_ORIGIN: "",
    ROYAL_MAIL_AUTH_MODE: "bearer",
    ...overrides,
  };
}
