import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { renderOrderEmail } from "../../src/lib/order-emails/template";
import type { EmailPurchase } from "../../src/lib/order-emails/model";

const purchase: EmailPurchase = {
  id: "50000000-0000-4000-8000-000000000001", order_number: "SEEN-012345ABCDEF", is_test: false,
  currency: "gbp", confirmed_at: "2026-10-21T10:00:00+00:00", subtotal_pence: 9000, delivery_pence: 0, tax_pence: 0, total_pence: 9000,
  details: { firstName: "Test", lastName: "Shopper", email: "customer@example.test", phone: "+447700900123", addressLine1: "1 Example Street", addressLine2: "Flat 2", city: "London", postcode: "SW1A 1AA", country: "GB" },
  delivery: { carrier: "Royal Mail", label: "Standard delivery" },
  items: [{ name: "Burgundy Roselle Edit", design_reference: "design-01", size: "58", quantity: 2, unit_price_pence: 4500 }],
};

test("customer email layout remains readable on phone and desktop", async ({ page }, testInfo) => {
  const email = renderOrderEmail(purchase, "customer_confirmation", { apiKey: "re_TEST_ONLY", from: "orders@mail.seenabayas.co.uk", origin: "https://www.seenabayas.co.uk", mode: "live" });
  for (const width of [390, 680]) {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent(email.html);
    await expect(page.getByRole("heading", { name: "Thank you for your order." })).toBeVisible();
    await expect(page.getByRole("table", { name: "YOUR PIECES" })).toContainText("Size 58");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`customer-email-${width}.png`), fullPage: true });
  }
});

test("owner sees queued notifications on a phone without causing any email send", async ({ page, request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
  await request.get("http://127.0.0.1:3108/__test/reset");
  const admin = { Origin: "http://127.0.0.1:3107" };
  expect((await page.request.post("/api/admin/auth", { headers: admin, data: { action: "login", email: "owner@example.test", password: "Test-password-only-123" } })).status()).toBe(200);
  const profile = await (await page.request.get("/api/admin/auth")).json();
  expect((await page.request.post("/api/admin/auth", { headers: admin, data: { action: "verify", factorId: profile.factors[0].id, code: "123456" } })).status()).toBe(200);
  const catalogue = await (await request.post("http://127.0.0.1:3106/rest/v1/rpc/get_storefront_catalog_v2", { data: {} })).json();
  const variant = catalogue[0].variants[0].id;
  const service = { apikey: "sb_secret_SEEN_LOCAL_FIXTURE_ONLY", Authorization: "Bearer sb_secret_SEEN_LOCAL_FIXTURE_ONLY" };
  const prepared = await request.post("http://127.0.0.1:3106/rest/v1/rpc/payment_prepare_order_v2", { headers: service, data: {
    request_id: randomUUID(), owner_hash: "a".repeat(64), request_hash: "b".repeat(64), details: purchase.details,
    requested_lines: [{ variant_id: variant, quantity: 2, unit_price_pence: 7500 }], shipping_method: "standard", expected_delivery: 0,
    return_origin: "http://127.0.0.1:3107", payment_mode: "live",
  } });
  expect(prepared.status()).toBe(200); const order = await prepared.json();
  const settled = await request.post("http://127.0.0.1:3106/rest/v1/rpc/payment_apply_session", { headers: service, data: {
    order_id: order.id, event_id: "evt_email_ui_fixture", event_type: "fixture_only", session: {
      id: "cs_live_EMAIL_FIXTURE_ONLY", order_id: order.id, request_hash: order.request_hash,
      total_pence: 15000, currency: "gbp", is_test: false, state: "paid", payment_intent: "pi_EMAIL_FIXTURE_ONLY",
    },
  } });
  expect(settled.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/orders");
  await page.getByText(order.order_number, { exact: true }).click();
  const status = page.getByRole("region", { name: "Order emails", exact: true });
  await expect(status).toContainText("Customer confirmation:");
  await expect(status).toContainText("Owner notification:");
  await expect(status).toContainText("Queued");
  await expect(status).toContainText("Automatic sending is disabled");
  await status.getByRole("button", { name: "Refresh email status" }).click();
  await expect(status).toContainText("Queued");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
