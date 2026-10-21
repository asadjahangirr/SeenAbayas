import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const variantId = "20000000-0000-4000-8000-000000000001";
const storageKey = "seen.bag.v1";
const drawer = (page: Page) => page.getByRole("dialog", { name: /^Your bag/ });
async function state(request: APIRequestContext, value: string) {
  const response = await request.post("http://127.0.0.1:3101/__test/state", { headers: { apikey: "sb_publishable_TEST_ONLY" }, data: { state: value } });
  expect(response.ok()).toBe(true);
}
async function addOne(page: Page) {
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "TEST S", exact: true }).click();
  const quoteResponse = page.waitForResponse((response) => response.url().endsWith("/api/bag") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  expect((await quoteResponse).status()).toBe(200);
  await expect(drawer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Open shopping bag, 1 item", exact: true })).toHaveAttribute("aria-expanded", "true");
}
test.beforeEach(async ({ request }) => { await state(request, "ready"); });

test("size selection waits for browser initialisation and the first hydrated choice is kept", async ({ page }) => {
  let release!: () => void;
  const hydration = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => { await hydration; await route.continue(); });
  try {
    await page.goto("/collection/design-01", { waitUntil: "commit" });
    const size = page.getByRole("button", { name: "TEST S", exact: true });
    await expect(size).toBeVisible();
    await expect(size).toBeDisabled();
    await expect(page.getByRole("button", { name: "Add to bag", exact: true })).toBeDisabled();
    release();
    await expect(size).toBeEnabled();
    await size.click();
    await expect(size).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Add to bag", exact: true }).click();
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).locator(".bag-line")).toHaveCount(1);
  } finally { release(); }
});

test("add, merge, change quantities, prevent overselling and remove with a live badge", async ({ page }) => {
  await addOne(page);
  await expect(drawer(page).locator(".bag-subtotal strong")).toHaveText("£123.45");
  await page.getByRole("button", { name: "Close shopping bag", exact: true }).click();
  await expect(drawer(page)).not.toBeVisible();
  await page.getByRole("button", { name: "Add another to bag", exact: true }).click();
  await expect(drawer(page).locator(".bag-line")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Open shopping bag, 2 items" })).toHaveAttribute("aria-expanded", "true");
  await drawer(page).getByRole("button", { name: "Increase quantity" }).click();
  await expect(drawer(page).locator(".bag-subtotal strong")).toHaveText("£370.35");
  await drawer(page).getByRole("button", { name: "Increase quantity" }).click();
  await expect(drawer(page).getByRole("alert")).toContainText("enough stock");
  await expect(drawer(page).locator(".bag-subtotal strong")).toHaveText("£370.35");
  await expect(page.getByRole("button", { name: "Open shopping bag, 3 items" })).toHaveAttribute("aria-expanded", "true");
  await drawer(page).getByRole("button", { name: /Remove TEST ONLY Burgundy/ }).click();
  await expect(drawer(page).getByRole("heading", { name: /Your next favourite/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open shopping bag, 0 items" })).toHaveAttribute("aria-expanded", "true");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), storageKey);
  expect(saved).toEqual({ version: 1, lines: [] });
});

test("saved bags revalidate prices, stock changes and the exact delivery threshold", async ({ page, request }) => {
  await addOne(page);
  await page.getByRole("button", { name: "Close shopping bag", exact: true }).click();
  await state(request, "repriced");
  await page.goto("/bag");
  await expect(page.locator(".bag-page .bag-subtotal strong")).toHaveText("£80.00");
  await expect(page.locator(".bag-page .bag-delivery p")).toHaveText("Your selection qualifies for complimentary standard UK delivery.");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), storageKey);
  expect(saved).toEqual({ version: 1, lines: [{ variantId, quantity: 1 }] });
  await state(request, "sold-out");
  await page.reload();
  await expect(page.locator(".bag-page .bag-line__issue")).toHaveText("This size is currently unavailable.");
  await expect(page.locator(".bag-page .bag-subtotal strong")).toHaveText("£0.00");
  await expect(page.locator(".bag-page .bag-subtotal")).toContainText("Available items subtotal");
  await page.getByRole("button", { name: /Remove TEST ONLY/ }).click();
  await expect(page.locator(".bag-page .bag-empty")).toBeVisible();
});

test("a saved selection can be reduced one step at a time after stock falls", async ({ page, request }) => {
  await addOne(page);
  const bag = drawer(page);
  await bag.getByRole("button", { name: "Increase quantity" }).click();
  await expect(bag.locator(".bag-subtotal strong")).toHaveText("£246.90");
  await bag.getByRole("button", { name: "Increase quantity" }).click();
  await expect(bag.locator(".bag-subtotal strong")).toHaveText("£370.35");
  await state(request, "low-stock");
  await page.goto("/bag");
  await expect(page.locator(".bag-page .bag-line__issue")).toContainText("reduce the quantity");
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(page.getByRole("button", { name: "Open shopping bag, 2 items", exact: true })).toBeVisible();
  await expect(page.locator(".bag-page .bag-line__issue")).toContainText("reduce the quantity");
  await page.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(page.getByRole("button", { name: "Open shopping bag, 1 item", exact: true })).toBeVisible();
  await expect(page.locator(".bag-page .bag-line__issue")).toHaveCount(0);
  await expect(page.locator(".bag-page .bag-subtotal strong")).toHaveText("£123.45");
});

test("unavailable sizes, missing size selection and failed backend checks never add a piece", async ({ page, request }) => {
  await page.goto("/collection/design-01");
  await expect(page.getByRole("button", { name: "TEST M, out of stock" })).toBeDisabled();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.locator(".piece-purchase").getByRole("alert")).toContainText("choose an available size");
  await page.getByRole("button", { name: "TEST S", exact: true }).click();
  await state(request, "missing-bag-rpc");
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.locator(".purchase-error")).toContainText("couldn't check");
  await expect(page.getByRole("button", { name: "Open shopping bag, 0 items" })).toBeVisible();
  await expect(drawer(page)).not.toBeVisible();
  await state(request, "ready");
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(drawer(page)).toBeVisible();
});

test("API rejects forged prices, duplicate IDs, excessive quantities and cross-origin requests", async ({ request }) => {
  for (const body of [{ lines: [{ variantId, quantity: 1, pricePence: 1 }] }, { lines: [{ variantId, quantity: 99 }] }, { lines: [{ variantId, quantity: 1 }, { variantId, quantity: 1 }] }, { lines: [], subtotalPence: 1 }]) {
    expect((await request.post("/api/bag", { data: body })).status()).toBe(400);
  }
  expect((await request.post("/api/bag", { data: { lines: [] }, headers: { origin: "https://untrusted.example" } })).status()).toBe(403);
  expect((await request.post("/api/bag", { data: "x".repeat(5000), headers: { "content-type": "application/json" } })).status()).toBe(413);
  const response = await request.post("/api/bag", { data: { lines: [{ variantId, quantity: 2 }] } });
  expect(response.ok()).toBe(true);
  const value = await response.json();
  expect(value.subtotalPence).toBe(24690);
  expect(value.lines[0].piece.pricePence).toBe(12345);
  expect(JSON.stringify(value)).not.toMatch(/on_hand|reserved|publishable|secret|TEST-S/);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("drawer keyboard focus, Escape restoration, motion and phone layouts are accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addOne(page);
  await expect(page.getByRole("button", { name: "Close shopping bag", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer(page).getByRole("link", { name: "Continue exploring" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close shopping bag", exact: true })).toBeFocused();
  await expect.poll(() => drawer(page).evaluate((element) => Math.abs(element.getBoundingClientRect().right - innerWidth) < 2)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: "test-results/bag-mobile-populated.png" });
  await page.keyboard.press("Escape");
  await expect(drawer(page)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Add another to bag" })).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open shopping bag, 1 item", exact: true }).click();
  expect(await drawer(page).evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.keyboard.press("Escape");
  await page.goto("/bag");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const bagPage = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(bagPage.violations).toEqual([]);
});

test("corrupt saved data is discarded and other tabs update the live bag", async ({ page, context }) => {
  await page.goto("/bag");
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, lines: [{ variantId: "forged", quantity: 99, pricePence: 1 }] })), storageKey);
  await page.reload();
  await expect(page.locator(".bag-page .bag-empty")).toBeVisible();
  const other = await context.newPage();
  await addOne(other);
  await page.bringToFront();
  await expect(page.getByRole("button", { name: "Open shopping bag, 1 item", exact: true })).toBeVisible();
  await expect(page.locator(".bag-page .bag-subtotal strong")).toHaveText("£123.45");
  await other.close();
});
