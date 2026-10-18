import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator("main").evaluate(async (main) => {
    const visibleAnimations = main.getAnimations({ subtree: true }).filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return target instanceof Element && target.checkVisibility();
    });
    await Promise.all(visibleAnimations.map((animation) => animation.finished.catch(() => {})));
  });
}

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`individual piece layout and photograph at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/collection/design-01");
    await settle(page);
    await expect(page).toHaveTitle("Burgundy | SEEN ABAYAS");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Burgundy");
    await expect.poll(() => page.locator(".piece-photo > img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await expect(page.locator(".piece-enquiry").getByRole("link", { name: "Enquire about this piece" })).toHaveAttribute("href", "mailto:info@seenabayas.co.uk?subject=SEEN%20enquiry%3A%20Burgundy%20(design-01)");
    await expect(page.getByRole("button", { name: /Add to (bag|cart)/i })).toHaveCount(0);
    expect(errors).toEqual([]);
    if (width === 390 || width === 1440) {
      for (const image of await page.locator(".piece-related .catalog-card__image > img:first-child").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await settle(page);
      await page.screenshot({ path: testInfo.outputPath(`piece-${width}.png`), fullPage: true });
    }
  });
}

test("thumbnails and arrow keys select actual product photographs", async ({ page }) => {
  await page.goto("/collection/design-01");
  const status = page.locator(".piece-gallery__meta");
  await page.getByRole("button", { name: "Show details photograph", exact: true }).click();
  await expect(status).toHaveText("Details3 / 4");
  await expect(page.locator(".piece-photo > img")).toHaveAttribute("alt", /Covered buttons and sleeve/);
  await expect(page.getByRole("button", { name: "Show details photograph", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Another angle4 / 4");
  await page.getByRole("button", { name: "Next product photograph", exact: true }).click();
  await expect(status).toHaveText("Front1 / 4");
  await page.getByRole("button", { name: "Previous product photograph", exact: true }).click();
  await expect(status).toHaveText("Another angle4 / 4");
});

test("photo viewer magnifies, supports scrolling and navigation, and restores focus", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/collection/design-01");
  const trigger = page.getByRole("button", { name: "Enlarge front photograph of Burgundy", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /Burgundy.*Photo viewer/ });
  const close = dialog.getByRole("button", { name: "Close enlarged photograph", exact: true });
  await expect(close).toBeFocused();
  await dialog.getByRole("button", { name: "Zoom in photograph", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Front · 1 / 4 · 200%");
  const viewport = dialog.locator(".piece-zoom__viewport");
  expect(await viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await viewport.focus();
  const initialLeft = await viewport.evaluate((element) => element.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initialLeft);
  await dialog.getByRole("button", { name: "Zoom out photograph", exact: true }).click();
  await dialog.getByRole("button", { name: "Next enlarged photograph", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Back · 2 / 4");
  await expect(dialog.locator("img")).toHaveAttribute("alt", /Back view of the burgundy/);
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await expect.poll(() => dialog.locator("img").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("enlarged-photograph.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Enlarge back photograph of Burgundy", exact: true })).toBeFocused();
});

test("single-photo pieces keep enlargement without redundant gallery controls", async ({ page }) => {
  await page.goto("/collection/design-05");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Textured charcoal");
  await expect(page.locator(".piece-gallery__meta")).toHaveText("Front1 / 1");
  await expect(page.locator(".piece-thumbnails")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next product photograph", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Enlarge front photograph of Textured charcoal", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Textured charcoal.*Photo viewer/ });
  await expect(dialog.getByRole("button", { name: "Next enlarged photograph", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Zoom in photograph", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Front · 1 / 1 · 200%");
});

test("collection cards open product pages and related links reset the gallery", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/collection");
  await page.getByRole("link", { name: "View piece: Burgundy", exact: true }).click();
  await expect(page).toHaveURL(/\/collection\/design-01$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Collection", exact: true })).toHaveAttribute("aria-current", "location");
  await page.getByRole("button", { name: "Show details photograph", exact: true }).click();
  const related = page.locator(".piece-related");
  await expect(related.locator(".catalog-card")).toHaveCount(3);
  await expect(related.getByRole("link", { name: "View piece: Burgundy", exact: true })).toHaveCount(0);
  await related.getByRole("link", { name: "View piece: Botanical detailing", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Botanical detailing");
  await expect(page.locator(".piece-gallery__meta")).toHaveText("Front1 / 2");
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "The collection", exact: true }).click();
  await expect(page).toHaveURL(/\/collection$/);
});

test("quick-view galleries link to the matching product page", async ({ page }) => {
  await page.goto("/collection");
  await page.getByRole("button", { name: "View photographs: Burgundy", exact: true }).click();
  await page.getByRole("dialog", { name: "Burgundy", exact: true }).getByRole("link", { name: "View this piece", exact: true }).click();
  await expect(page).toHaveURL(/\/collection\/design-01$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Burgundy");
});

test("sizing and delivery disclosures use keyboard controls and confirmed delivery text", async ({ page }) => {
  await page.goto("/collection/design-01");
  const sizing = page.locator("details").filter({ hasText: "Sizing & fit" });
  await sizing.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(sizing.locator("p")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(sizing.locator("p")).not.toBeVisible();
  const delivery = page.locator("details").filter({ hasText: "UK delivery" });
  await delivery.locator("summary").click();
  await expect(delivery.locator("p")).toHaveText("Complimentary standard UK delivery on orders over £80.");
});

test("touch swipes change the product photo without opening enlargement", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("/collection/design-01");
    const photo = page.locator(".piece-photo");
    await photo.scrollIntoViewIfNeeded();
    const bounds = (await photo.boundingBox())!;
    const x = Math.min(bounds.x + bounds.width - 35, 350);
    const y = Math.min(bounds.y + bounds.height / 2, 650);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 28, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".piece-gallery__meta")).toHaveText("Back2 / 4");
    await expect(page.getByRole("dialog", { name: /Photo viewer/ })).not.toBeVisible();
    await photo.tap();
    const dialog = page.getByRole("dialog", { name: /Burgundy.*Photo viewer/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Zoom in photograph", exact: true }).tap();
    await expect(dialog.getByRole("status")).toHaveText("Back · 2 / 4 · 200%");
    await dialog.getByRole("button", { name: "Close enlarged photograph", exact: true }).tap();
    await expect(dialog).not.toBeVisible();
  } finally { await context.close(); }
});

for (const width of [390, 1440]) {
  test(`product accessibility at ${width}px including magnified viewer`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/collection/design-01");
    await settle(page);
    const scan = () => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect((await scan()).violations).toEqual([]);
    await page.getByRole("button", { name: "Enlarge front photograph of Burgundy", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in photograph", exact: true }).click();
    expect((await scan()).violations).toEqual([]);
  });
}

test("reduced motion keeps photo navigation without animated transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "Next product photograph", exact: true }).click();
  await expect(page.locator(".piece-gallery__meta")).toHaveText("Back2 / 4");
  expect(await page.locator("main").evaluate((main) => main.getAnimations({ subtree: true }).length)).toBe(0);
});

test("all photographed pieces resolve, unknown IDs return a real unindexed 404", async ({ request }) => {
  for (const id of ["01", "02", "03", "04", "05", "06", "07"]) {
    const response = await request.get(`/collection/design-${id}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const nonce = response.headers()["content-security-policy"].match(/'nonce-([^']+)'/)?.[1];
    const html = await response.text();
    expect(nonce).toBeTruthy();
    for (const script of html.match(/<script\b[^>]*>/g) || []) expect(script).toContain(`nonce="${nonce}"`);
    expect(html).toContain('id="piece-title"');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  }
  const unknown = await request.get("/collection/design-08");
  expect(unknown.status()).toBe(404);
  expect(await unknown.text()).toContain("This piece could not be found.");
});

test("without JavaScript the product photograph, enquiry link and native disclosures remain usable", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/collection/design-01");
    await expect(page.locator(".piece-photo > img")).toBeVisible();
    await expect(page.locator(".piece-enquiry").getByRole("link", { name: "Enquire about this piece" })).toBeVisible();
    const details = page.locator("details").filter({ hasText: "Sizing & fit" });
    await details.locator("summary").click();
    await expect(details.locator("p")).toBeVisible();
  } finally { await context.close(); }
});
