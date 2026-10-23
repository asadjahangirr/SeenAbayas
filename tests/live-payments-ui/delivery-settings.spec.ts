import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const headers = { Origin: "http://127.0.0.1:3107", "Content-Type": "application/json" };
const details = { email: "delivery-test@example.test", firstName: "Test", lastName: "Shopper", phone: "", addressLine1: "1 Example Street", addressLine2: "", city: "London", postcode: "SW1A 1AA", country: "GB" };
test.use({ actionTimeout: 15_000 });
async function publish(page: Page) {
  await page.getByRole("button", { name: "Save & update store", exact: true }).click();
  await expect(page.getByText("Published. Your changes", { exact: false })).toBeVisible();
}

for (const width of [393, 1440]) test(`owner delivery fee and banner reach checkout and Stripe at ${width}px`, async ({ page, browser, request }) => {
  test.setTimeout(90_000);
  await request.get("http://127.0.0.1:3106/__test/reset");
  await request.get("http://127.0.0.1:3108/__test/reset");
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Test-password-only-123");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.goto("/admin/settings");
  await expect(page.getByLabel("Standard delivery charge (£)", { exact: true })).toHaveCount(1);
  await page.getByLabel("Standard delivery charge (£)", { exact: true }).fill("4.25");
  await page.getByLabel("Free delivery threshold (£)").fill("80");
  await page.getByLabel("Banner message", { exact: true }).fill("Free standard delivery from {threshold}. Shop the collection.");
  await expect(page.getByLabel("Banner preview", { exact: true })).toContainText("from £80");
  await expect(page.getByLabel("Delivery rule summary", { exact: true })).toContainText("£4.25");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: false })).toBeVisible();

  // Separate customer context: admin drafts must never change the public quote.
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  try {
    const shop = await context.newPage();
    await shop.goto("http://127.0.0.1:3107/collection/design-01");
    await shop.getByRole("button", { name: "54", exact: true }).click();
    await shop.getByRole("button", { name: "Add to bag", exact: true }).click();
    await expect(shop.getByRole("dialog", { name: /^Your bag/ })).toBeVisible();
    const lines = await shop.evaluate(() => JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
    const review = async () => {
      const response = await shop.request.post("http://127.0.0.1:3107/api/checkout/review", { headers, data: { details, shippingMethod: "standard", lines } });
      expect(response.status()).toBe(200);
      return response.json();
    };
    expect((await review()).delivery.chargePence).toBeNull();
    await publish(page);
    const charged = await review();
    expect(charged).toMatchObject({ paymentAvailable: true, estimatedTotalPence: 7925, delivery: { chargePence: 425 } });
    await expect.poll(async () => (await shop.request.get("http://127.0.0.1:3107/collection")).text()).toContain("Free standard delivery from £80");
    await shop.goto("http://127.0.0.1:3107/checkout");
    await expect(shop.locator(".checkout-total dd")).toHaveText("£79.25");

    // The exact merchandise threshold qualifies; changing it invalidates the old review.
    await page.getByLabel("Free delivery threshold (£)").fill("75");
    await publish(page);
    expect(await review()).toMatchObject({ estimatedTotalPence: 7500, delivery: { chargePence: 0 } });
    expect((await shop.request.post("http://127.0.0.1:3107/api/checkout/session", { headers, data: { details, shippingMethod: "standard", lines, requestId: randomUUID(), reviewFingerprint: charged.reviewFingerprint } })).status()).toBe(409);

    await page.getByRole("combobox", { name: "Complimentary UK delivery", exact: true }).selectOption("false");
    await page.getByRole("button", { name: "Use automatic delivery message", exact: true }).click();
    await expect(page.getByLabel("Banner preview", { exact: true })).toHaveText("UK delivery available. View delivery information.");
    await publish(page);
    expect(await review()).toMatchObject({ estimatedTotalPence: 7925, delivery: { chargePence: 425 } });

    // A zero charge is explicit free postage, while blank is unconfirmed.
    await page.getByLabel("Standard delivery charge (£)", { exact: true }).fill("0");
    await publish(page);
    expect(await review()).toMatchObject({ estimatedTotalPence: 7500, delivery: { chargePence: 0 } });
    await page.getByLabel("Standard delivery charge (£)", { exact: true }).fill("");
    await publish(page);
    expect(await review()).toMatchObject({ paymentAvailable: false, estimatedTotalPence: null, delivery: { chargePence: null } });

    await page.getByLabel("Standard delivery charge (£)", { exact: true }).fill("4.25");
    await publish(page);
    const final = await review();
    const opened = await shop.request.post("http://127.0.0.1:3107/api/checkout/session", { headers, data: { details, shippingMethod: "standard", lines, requestId: randomUUID(), reviewFingerprint: final.reviewFingerprint } });
    expect(opened.status()).toBe(200);
    const state = await (await request.get("http://127.0.0.1:3108/__test/state")).json();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]).toMatchObject({ amount_total: 7925, livemode: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  } finally { await context.close(); }
});
