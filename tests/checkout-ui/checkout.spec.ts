import { expect, test, devices, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const customer = {
  email: "checkout-shopper@example.test",
  firstName: "Test",
  lastName: "Shopper",
  phone: "",
  addressLine1: "1 Example Street",
  addressLine2: "Flat 2",
  city: "London",
  postcode: "sw1a1aa",
  country: "GB",
};
const headers = {
  Origin: "http://127.0.0.1:3107",
  "Content-Type": "application/json",
};

test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
});

async function start(page: Page, quantity = 1) {
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "54", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  const bag = page.getByRole("dialog", { name: /^Your bag/ });
  await expect(bag).toBeVisible();
  if (quantity === 2) {
    await bag.getByRole("button", { name: "Increase quantity" }).click();
    await expect(bag.locator(".bag-subtotal strong")).toHaveText("£150.00");
  }
  await bag.getByRole("link", { name: "View shopping bag" }).click();
  await page
    .getByRole("link", { name: "Continue to checkout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(
    page.getByRole("form", { name: "Contact and delivery details" }),
  ).toBeVisible();
}
async function fill(page: Page) {
  for (const [name, value] of Object.entries(customer))
    if (name !== "country") await page.locator(`#checkout-${name}`).fill(value);
}

test("bag leads to a truthful preview, validates fields, reviews details and keeps personal data out of storage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  await expect(page.locator(".checkout-preview")).toContainText(
    "no order will be placed",
  );
  await expect(page.locator(".checkout-total dd")).toHaveText(
    "To be confirmed",
  );
  await page
    .getByRole("button", { name: "Review your details", exact: true })
    .click();
  await expect(page.locator(".checkout-error")).toBeFocused();
  await expect(page.locator("#checkout-email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await fill(page);
  await page
    .getByRole("button", { name: "Review your details", exact: true })
    .click();
  await expect(page.locator("#checkout-review-title")).toBeFocused();
  await expect(page.locator(".checkout-review address")).toContainText(
    "SW1A 1AA",
  );
  await expect(
    page.getByRole("button", { name: "Delivery rate unavailable", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".checkout-payment")).toContainText(
    "No order has been placed",
  );
  const stored = await page.evaluate(() =>
    JSON.stringify([
      Object.entries(localStorage),
      Object.entries(sessionStorage),
    ]),
  );
  expect(stored).not.toContain(customer.email);
  expect(stored).not.toContain(customer.addressLine1);
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await expect(page.locator("#checkout-email")).toHaveValue(customer.email);
  await expect(page.locator("#checkout-email")).toBeFocused();
  await page.reload();
  await expect(page.locator("#checkout-email")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("qualifying selections show complimentary standard delivery and an estimated total with unconfirmed tax", async ({
  page,
}) => {
  await start(page, 2);
  await expect(page.locator(".checkout-total dd")).toHaveText("£150.00");
  await expect(page.locator(".checkout-delivery-price")).toHaveText(
    "Complimentary",
  );
  await fill(page);
  await page
    .getByRole("button", { name: "Review your details", exact: true })
    .click();
  await expect(page.locator(".checkout-review")).toBeVisible();
  await expect(page.locator(".checkout-total dd")).toHaveText("£150.00");
  await expect(
    page.getByRole("button", { name: "Payment unavailable", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".checkout-payment")).toContainText(
    "Payment is currently unavailable.",
  );
  await expect(page.locator(".checkout-payment")).not.toContainText(
    "The delivery rate for your selection has not been set",
  );
  await expect(page.locator(".checkout-estimate-note")).toContainText(
    "not a final payable total",
  );
});

test("review endpoint validates origin, body, UK address and tampering; response uses current server prices", async ({
  page,
  request,
}) => {
  await start(page);
  const lines = await page.evaluate(
    () => JSON.parse(localStorage.getItem("seen.bag.v1")!).lines,
  );
  const payload = { details: customer, shippingMethod: "standard", lines };
  const good = await request.post("/api/checkout/review", {
    headers,
    data: payload,
  });
  expect(good.status()).toBe(200);
  expect(good.headers()["cache-control"]).toContain("no-store");
  expect(await good.json()).toMatchObject({
    mode: "preview",
    paymentAvailable: false,
    taxStatus: "unconfirmed",
    bag: { subtotalPence: 7500 },
    details: { postcode: "SW1A 1AA" },
  });
  for (const body of [
    { ...payload, totalPence: 1 },
    { ...payload, lines: [{ ...lines[0], pricePence: 1 }] },
    { ...payload, details: { ...customer, country: "FR" } },
    { ...payload, details: { ...customer, postcode: "invalid" } },
    { ...payload, lines: [] },
    { ...payload, lines: [{ ...lines[0], quantity: 11 }] },
  ])
    expect(
      (
        await request.post("/api/checkout/review", { headers, data: body })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post("/api/checkout/review", {
        headers: { ...headers, Origin: "https://unrelated.example" },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/checkout/review", {
        headers: { ...headers, "Content-Type": "text/plain" },
        data: "bad",
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post("/api/checkout/review", {
        headers,
        data: "x".repeat(17000),
      })
    ).status(),
  ).toBe(413);
  expect(
    (
      await request.post("/api/checkout/review", {
        headers,
        data: {
          ...payload,
          lines: [
            { ...lines[0], variantId: "20000000-0000-4000-8000-000000000099" },
          ],
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/checkout/review", {
        headers,
        data: { ...payload, shippingMethod: "express" },
      })
    ).status(),
  ).toBe(409);
});

test("failed review retains details and duplicate taps do not submit twice", async ({
  page,
}) => {
  await start(page);
  await fill(page);
  let calls = 0;
  await page.route("**/api/checkout/review", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "We couldn't review your selection. Please try again.",
      }),
    });
  });
  await page
    .getByRole("button", { name: "Review your details", exact: true })
    .dblclick();
  await expect(page.locator(".checkout-error")).toContainText(
    "Please try again",
  );
  expect(calls).toBe(1);
  await expect(page.locator("#checkout-email")).toHaveValue(customer.email);
  await page.unroute("**/api/checkout/review");
  await page
    .getByRole("button", { name: "Review your details", exact: true })
    .click();
  await expect(page.locator(".checkout-review")).toBeVisible();
});

test("a bag change during review cannot display an outdated selection", async ({ page }) => {
  await start(page);
  await fill(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/checkout/review", async (route) => { await held; await route.continue(); });
  await page.getByRole("button", { name: "Review your details", exact: true }).click();
  await expect(page.getByRole("button", { name: "Checking your selection…", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Open shopping bag, 1 item", exact: true }).click();
  const bag = page.getByRole("dialog", { name: /^Your bag/ });
  await bag.getByRole("button", { name: "Increase quantity", exact: true }).click();
  await expect(bag.locator(".bag-subtotal strong")).toHaveText("£150.00");
  await bag.getByRole("button", { name: "Close shopping bag", exact: true }).click();
  release();
  await expect(page.locator(".checkout-error")).toContainText("Your selection changed");
  await page.unroute("**/api/checkout/review");
  await page.getByRole("button", { name: "Review your details", exact: true }).click();
  await expect(page.locator(".checkout-review")).toBeVisible();
  await expect(page.locator(".checkout-total dd")).toHaveText("£150.00");
});

test("empty checkout remains navigable and is not indexed", async ({
  page,
}) => {
  await page.goto("/checkout");
  await expect(page.locator(".checkout-page .bag-empty")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("link", { name: "Discover the collection", exact: true }),
  ).toBeVisible();
});

for (const width of [320, 393, 768, 1440])
  test(`checkout form and review are accessible without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await start(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if (width === 393 || width === 1440)
      await page.screenshot({
        path: `test-results/checkout-ui/form-${width}.png`,
        fullPage: true,
      });
    await fill(page);
    await page
      .getByRole("button", { name: "Review your details", exact: true })
      .click();
    await expect(page.locator(".checkout-review")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });

test.describe("Android touch checkout", () => {
  test.use({
    viewport: devices["Pixel 5"].viewport,
    deviceScaleFactor: devices["Pixel 5"].deviceScaleFactor,
    userAgent: devices["Pixel 5"].userAgent,
    isMobile: true,
    hasTouch: true,
  });
  test("touch entry and review work without newer AbortSignal APIs", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(AbortSignal, "any", {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(AbortSignal, "timeout", {
        value: undefined,
        configurable: true,
      });
    });
    await start(page);
    await fill(page);
    await page
      .getByRole("button", { name: "Review your details", exact: true })
      .tap();
    await expect(page.locator(".checkout-review")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delivery rate unavailable", exact: true }),
    ).toBeDisabled();
  });
});
