import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the home edit opens a named sample product with prices, lengths and Add to Bag", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByLabel("Development catalogue notice")).toHaveCount(0);
  await expect(page.locator(".collection-card")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /View more pieces/ })).toHaveCount(0);
  await page.locator(".collection-card").getByRole("link", { name: "View piece: Layla Burgundy Abaya", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Layla Burgundy Abaya");
  await expect(page.locator(".piece-price")).toHaveText("£75.00");
  await expect(page.getByRole("group", { name: "Choose your length (inches)" }).getByRole("button")).toHaveText(["52", "54", "56", "58", "60"]);
  await expect(page.getByRole("button", { name: "Add to bag", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Ask about sizing or availability" })).toBeVisible();
  await expect(page.locator(".piece-zoom")).toHaveCount(0);
  await expect.poll(() => page.locator(".piece-photo > img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("product-with-sizes.png"), fullPage: true });
});

test("the complete catalogue shows all seven sample prices with a compact heading", async ({ page }, testInfo) => {
  await page.goto("/collection");
  await expect(page.locator(".catalog-card")).toHaveCount(7);
  await expect(page.locator(".catalog-intro img")).toHaveCount(0);
  await expect(page.locator(".catalog-card__name")).toHaveText(["Amal Neutral Abaya", "Haya Charcoal Abaya", "Layla Burgundy Abaya", "Luma Polka Dot Abaya", "Noor Lace Abaya", "Rima Textured Abaya", "Zahra Botanical Abaya"]);
  await expect(page.locator(".catalog-card__price")).toHaveText(["£75.00", "£69.00", "£75.00", "£69.00", "£85.00", "£75.00", "£85.00"]);
  await page.screenshot({ path: testInfo.outputPath("collection-with-prices.png") });
});

for (const width of [390, 1440]) {
  test(`collection search matches partial colours and product names at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/collection");
    const search = page.getByRole("searchbox", { name: "Search the collection" });
    const names = page.locator(".catalog-card__name");
    const sort = page.getByRole("combobox", { name: "Sort by" });
    await expect(sort.locator("option")).toHaveText(["Alphabetical: A to Z", "Alphabetical: Z to A"]);
    await search.pressSequentially("r");
    await expect(names).toHaveText(["Layla Burgundy Abaya", "Rima Textured Abaya"]);
    await search.pressSequentially("e");
    await expect(names).toHaveText(["Layla Burgundy Abaya"]);
    await search.fill(" RED ");
    await expect(names).toHaveText(["Layla Burgundy Abaya"]);
    await search.fill(" lAy ");
    await expect(names).toHaveText(["Layla Burgundy Abaya"]);
    await search.fill("noor la");
    await expect(names).toHaveText(["Noor Lace Abaya"]);
    await search.fill("re");
    await page.getByRole("group", { name: "Filter by photographed colour" }).getByRole("button", { name: "Black", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No pieces match your search." })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(names).toHaveCount(7);
    await sort.selectOption("za");
    await expect(names.first()).toHaveText("Zahra Botanical Abaya");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test("sample quantities are checked on the server and the saved bag is separate from the live bag", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:3103")) external.push(request.url()); });
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "56", exact: true }).click();
  const quoteResponse = page.waitForResponse((response) => response.url().endsWith("/api/bag") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  expect((await quoteResponse).status()).toBe(200);
  const drawer = page.getByRole("dialog", { name: /^Your bag/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".bag-subtotal strong")).toHaveText("£75.00");
  for (let quantity = 2; quantity <= 5; quantity++) {
    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(drawer.locator(".bag-subtotal strong")).toHaveText(`£${(75 * quantity).toFixed(2)}`);
  }
  await drawer.getByRole("button", { name: "Increase quantity" }).click();
  await expect(drawer.getByRole("alert")).toContainText("enough stock");
  await expect(drawer.locator(".bag-subtotal strong")).toHaveText("£375.00");
  await expect(page.getByRole("button", { name: "Open shopping bag, 5 items", exact: true })).toHaveAttribute("aria-expanded", "true");
  const saved = await page.evaluate(() => ({ sample: JSON.parse(localStorage.getItem("seen.bag.v1.development") || "null"), live: localStorage.getItem("seen.bag.v1") }));
  expect(saved.live).toBeNull();
  expect(saved.sample.lines[0]).toEqual({ variantId: "70000000-0000-4000-8000-000001000003", quantity: 5 });
  await page.goto("/bag");
  await expect(page.locator(".bag-page .bag-subtotal strong")).toHaveText("£375.00");
  await expect(page.getByRole("button", { name: /checkout|pay now/i })).toHaveCount(0);
  expect(external).toEqual([]);
});

test("the sample purchase flow is responsive and accessible on a phone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/collection/design-01");
  await expect(page.getByRole("button", { name: "Add to bag", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "54", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /^Your bag/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("sample-bag-mobile.png") });
});
