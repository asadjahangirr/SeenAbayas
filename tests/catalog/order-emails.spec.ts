import { expect, test } from "@playwright/test";
import { emailPurchaseSchema, orderEmailConfiguration, type EmailPurchase } from "../../src/lib/order-emails/model";
import { renderOrderEmail } from "../../src/lib/order-emails/template";

const env = { ORDER_EMAILS_ENABLED: "true", PAYMENTS_MODE: "live", RESEND_API_KEY: "re_TEST_ONLY_NEVER_SENT", ORDER_FROM_EMAIL: "orders@mail.seenabayas.co.uk", NEXT_PUBLIC_SITE_URL: "https://www.seenabayas.co.uk" };
test("order email configuration is independent of Turnstile and refuses unsafe or incomplete settings", () => {
  expect(orderEmailConfiguration(env).config).toBeTruthy();
  for (const change of [{ ORDER_EMAILS_ENABLED: "false" }, { RESEND_API_KEY: " re_bad " }, { ORDER_FROM_EMAIL: "a\r\nb@example.test" },
    { NEXT_PUBLIC_SITE_URL: "http://external.example.test" }, { NEXT_PUBLIC_SITE_URL: "https://name:pass@seen.example.test" }, { ORDER_EMAIL_TEST_RECIPIENT: "bad" }])
    expect(orderEmailConfiguration({ ...env, ...change }).config).toBeNull();
  expect(orderEmailConfiguration({ ...env, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).config).toBeTruthy();
});

test("email rendering escapes customer/product text, contains full purchased details and omits payment capabilities", () => {
  const order: EmailPurchase = {
    id: "50000000-0000-4000-8000-000000000001", order_number: "SEEN-012345ABCDEF", is_test: false,
    currency: "gbp", confirmed_at: "2026-10-21T10:00:00+00:00", discount_pence:0, subtotal_pence: 9000, delivery_pence: 0, tax_pence: 0, total_pence: 9000,
    details: { firstName: "<script>alert(1)</script>", lastName: "& 'Test'", email: "customer@example.test", phone: "+447700900123", addressLine1: '1 "Test" Street', addressLine2: "Flat 2", city: "London", postcode: "SW1A 1AA", country: "GB" },
    delivery: { carrier: "Royal Mail", label: "Standard delivery" },
    items: [{ name: "Burgundy <img onerror=x>", design_reference: "design-01", size: "58", quantity: 2, unit_price_pence: 4500 }],
  };
  expect(emailPurchaseSchema.safeParse(order).success).toBe(true);
  expect(emailPurchaseSchema.safeParse({ ...order, total_pence: 1 }).success).toBe(false);
  const config = orderEmailConfiguration(env).config!;
  const message = renderOrderEmail(order, "customer_confirmation", config);
  expect(message.html).not.toContain("<script>"); expect(message.html).not.toContain("<img onerror");
  expect(message.html).toContain("&lt;script&gt;"); expect(message.html).toContain("&lt;img onerror=x&gt;");
  expect(message.text).toContain("Size 58 | Quantity 2 | £45.00 each | £90.00");
  expect(message.text).toContain("Flat 2"); expect(message.text).toContain("Royal Mail");
  expect(message.text).toContain("Delivery: Complimentary"); expect(message.subject).not.toMatch(/[\r\n]/);
  expect(JSON.stringify(message)).not.toMatch(/owner_hash|session_id|payment_intent|checkout\.stripe|sk_live|rk_live/);
  expect(renderOrderEmail(order, "owner_notification", config).to).toEqual(["info@seenabayas.co.uk"]);
});
