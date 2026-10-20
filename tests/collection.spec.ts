import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator("main").evaluate(async (main) => {
    await Promise.all(main.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
}

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`collection layout and photography at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/collection");
    await settle(page);
    await expect(page).toHaveTitle("The Collection | SEEN ABAYAS");
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("The Collection");
    await expect(page.locator(".catalog-card")).toHaveCount(9);
    await expect(page.locator(".catalog-toolbar").getByRole("status")).toHaveText("9 pieces");
    await expect(page.locator(".catalog-intro img")).toHaveCount(0);
    const heading = await page.locator(".catalog-heading").boundingBox();
    expect(heading!.height).toBeLessThan(160);
    const firstImage = page.locator(".catalog-card__image > img").first();
    await firstImage.scrollIntoViewIfNeeded();
    await expect.poll(() => firstImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    expect(errors).toEqual([]);
    if (width === 390 || width === 1440) {
      // Load the remaining lazy images for the full-page visual review.
      for (const card of await page.locator(".catalog-card").all()) await card.scrollIntoViewIfNeeded();
      for (const image of await page.locator(".catalog-card__image > img:first-child").all()) {
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await settle(page);
      await page.screenshot({ path: testInfo.outputPath(`collection-${width}.png`), fullPage: true });
    }
  });
}

test("colour filters combine with multi-word search, and empty results can be reset", async ({ page }) => {
  await page.goto("/collection");
  const colours = page.getByRole("group", { name: "Filter by photographed colour" });
  const status = page.locator(".catalog-toolbar").getByRole("status");
  await colours.getByRole("button", { name: "Black", exact: true }).click();
  await expect(status).toHaveText("3 pieces");
  await expect(colours.getByRole("button", { name: "Black", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("searchbox", { name: "Search the collection" }).fill("black lace");
  await expect(status).toHaveText("1 piece");
  await expect(page.locator(".catalog-card__name")).toHaveText("Lace detailing");
  await colours.getByRole("button", { name: "Burgundy", exact: true }).click();
  await expect(status).toHaveText("0 pieces");
  await expect(page.getByRole("heading", { name: "No pieces match your search." })).toBeVisible();
  await page.getByRole("button", { name: "View all pieces", exact: true }).click();
  await expect(status).toHaveText("9 pieces");
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(colours.getByRole("button", { name: "All pieces", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("searchbox").fill("  TEAL  ");
  await expect(status).toHaveText("1 piece");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await expect(status).toHaveText("9 pieces");
});

test("sorting changes the displayed order without dropping the selected colour", async ({ page }) => {
  await page.goto("/collection");
  const names = page.locator(".catalog-card__name");
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("za");
  await expect(names.first()).toHaveText("Tie dye blue");
  await page.getByRole("group", { name: "Filter by photographed colour" }).getByRole("button", { name: "Black", exact: true }).click();
  await expect(names).toHaveText(["Polka dots", "Lace detailing", "Botanical detailing"]);
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("az");
  await expect(names).toHaveText(["Botanical detailing", "Lace detailing", "Polka dots"]);
  await expect(page.getByRole("combobox", { name: "Sort by" }).locator("option")).toHaveText(["Alphabetical: A to Z", "Alphabetical: Z to A"]);
});

test("collection photographs open the product directly without a quick-view action", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.locator(".catalog-card__quickview")).toHaveCount(0);
  await page.getByRole("link", { name: "View piece: Cream", exact: true }).click();
  await expect(page).toHaveURL(/\/collection\/design-07$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cream");
  await expect(page.locator(".piece-gallery__meta")).toHaveText("Front1 / 2");
  await expect(page.getByRole("button", { name: "Add to bag", exact: true })).toBeVisible();
});

test("desktop navigation opens the collection, marks it current, and returns to the homepage", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const link = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Collection", exact: true });
  await link.click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(link).toHaveAttribute("aria-current", "page");
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Made to Be Seen.");
  await expect(link).not.toHaveAttribute("aria-current", "page");
});

test("touch navigation and colour filters lead directly to the chosen product", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).tap();
    await page.getByRole("dialog", { name: "Explore SEEN" }).getByRole("link", { name: "Collection", exact: true }).tap();
    await expect(page).toHaveURL(/\/collection$/);
    await expect(page.getByRole("dialog", { name: "Explore SEEN" })).not.toBeVisible();
    await page.getByRole("group", { name: "Filter by photographed colour" }).getByRole("button", { name: "Cream", exact: true }).tap();
    await expect(page.locator(".catalog-card")).toHaveCount(1);
    await page.getByRole("link", { name: "View piece: Cream", exact: true }).tap();
    await expect(page).toHaveURL(/\/collection\/design-07$/);
    await page.getByRole("button", { name: "Next product photograph", exact: true }).tap();
    await expect(page.locator(".piece-gallery__meta")).toHaveText("Details2 / 2");
  } finally { await context.close(); }
});

for (const width of [390, 1440]) {
  test(`collection accessibility at ${width}px including search and empty state`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/collection");
    await settle(page);
    const scan = () => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect((await scan()).violations).toEqual([]);
    await page.getByRole("searchbox").fill("no matching photographs");
    expect((await scan()).violations).toEqual([]);
  });
}

test("alternate images animate on desktop hover without moving the card", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/collection");
  const card = page.getByRole("link", { name: "View piece: Burgundy", exact: true });
  await card.scrollIntoViewIfNeeded();
  await settle(page);
  const before = await card.boundingBox();
  const alternate = card.locator(".catalog-card__alternate");
  await expect.poll(() => alternate.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await card.hover();
  await expect.poll(() => alternate.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  expect(await card.boundingBox()).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath("collection-hover.png") });
});

test("collection respects reduced motion while preserving browsing controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/collection");
  await page.locator(".catalog-card").last().scrollIntoViewIfNeeded();
  expect(await page.locator("main").evaluate((main) => main.getAnimations({ subtree: true }).length)).toBe(0);
  await page.getByRole("group", { name: "Filter by photographed colour" }).getByRole("button", { name: "Teal", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  expect(await page.locator("main").evaluate((main) => main.getAnimations({ subtree: true }).length)).toBe(0);
});

test("collection HTML retains photographs without client JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/collection");
    await expect(page.locator(".catalog-card")).toHaveCount(9);
    await expect(page.locator(".catalog-card").first()).toBeVisible();
    expect(await page.locator(".catalog-grid > div").first().evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  } finally { await context.close(); }
});

test("collection responses keep nonce protection and indexing disabled", async ({ request }) => {
  const response = await request.get("/collection");
  expect(response.status()).toBe(200);
  const nonce = response.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(response.headers()["cache-control"]).toContain("no-store");
  const html = await response.text();
  for (const script of html.match(/<script\b[^>]*>/g) || []) expect(script).toContain(`nonce="${nonce}"`);
  expect(html).toContain('name="robots" content="noindex, nofollow"');
});
