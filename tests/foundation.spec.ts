import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function settleHero(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".hero").evaluate(async (hero) => {
    await Promise.all(hero.getAnimations({ subtree: true }).map((animation) => animation.finished));
  });
}

for (const width of [320, 375, 768, 1024, 1440, 1920]) {
  test(`responsive layout and real images at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await settleHero(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Made to\s*Be Seen\./);
    const images = page.locator('.hero-visuals .flip-photo__face[aria-hidden="false"] img');
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const titleLines = page.locator(".hero-title-line");
    await expect(titleLines).toHaveCount(2);
    await expect(titleLines.nth(0)).toHaveText("Made to");
    await expect(titleLines.nth(1)).toHaveText("Be Seen.");
    for (const line of await titleLines.all()) {
      expect(await line.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    expect(errors).toEqual([]);

    if (width === 320 || width === 1440) {
      await page.screenshot({ path: testInfo.outputPath(`hero-${width}.png`) });
      await page.screenshot({ path: testInfo.outputPath(`foundation-${width}.png`), fullPage: true });
    }
  });
}

test("mobile menu traps focus, closes with Escape, and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: "Open navigation menu" });
  const dialog = page.getByRole("dialog", { name: "Explore SEEN" });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByRole("button", { name: "Close navigation menu" })).toBeFocused();

  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await dialog.getByRole("link", { name: "Our Story" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/#our-story$/);
});

test("resizing to desktop closes the mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("skip navigation works and every foundation link has a real destination", async ({ page, request }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const invalidLinks = await page.locator("a[href]").evaluateAll((links) =>
    links.flatMap((link) => {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("mailto:")) return [];
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === "/collection" && !url.hash) return [];
      if (url.origin !== window.location.origin || url.pathname !== "/") return [href];
      return url.hash && document.getElementById(url.hash.slice(1)) ? [] : [href];
    }),
  );
  expect(invalidLinks).toEqual([]);
  expect((await request.get("/collection")).status()).toBe(200);
});

for (const width of [375, 1440]) {
  test(`accessibility scan at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await settleHero(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      const menuResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(menuResults.violations).toEqual([]);
      await page.keyboard.press("Escape");
    }

    await page.getByRole("button", { name: "View photographs: Burgundy", exact: true }).click();
    const galleryResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(galleryResults.violations).toEqual([]);
  });
}

test("security headers use fresh nonces and previews remain unindexed", async ({ request }) => {
  const first = await request.get("/");
  const second = await request.get("/");
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);

  const headers = first.headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["cache-control"]).toContain("no-store");

  const policy = headers["content-security-policy"];
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("unsafe-eval");
  expect(policy.split(";").find((directive) => directive.trim().startsWith("script-src")))
    .not.toContain("unsafe-inline");
  expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);

  const html = await first.text();
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) expect(script).toContain(`nonce="${nonce}"`);
  expect(html).toContain('name="robots" content="noindex, nofollow"');
});

test("CSP blocks untrusted inline scripts injected into the document response", async ({ page }) => {
  // Browser evaluation is privileged. Test actual parser-inserted, non-nonced HTML instead.
  await page.route("http://127.0.0.1:3100/", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const body = html.replace(
      "</head>",
      '<script id="untrusted-test-script">window.__foundationInlineScriptExecuted = true</script></head>',
    );
    await route.fulfill({ response, body });
  });

  await page.goto("/");
  await expect(page.locator("#untrusted-test-script")).toHaveCount(1);
  const executed = await page.evaluate(() =>
    Object.prototype.hasOwnProperty.call(window, "__foundationInlineScriptExecuted"),
  );
  expect(executed).toBe(false);
});

test("image optimization rejects unapproved external sources", async ({ request }) => {
  const response = await request.get("/_next/image", {
    params: { url: "https://example.com/image.jpg", w: 640, q: 75 },
  });
  expect(response.status()).toBe(400);
});

test("reduced-motion preference disables smooth scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  await expect(page.getByRole("button", { name: "Pause delivery announcement" })).not.toBeVisible();
  expect(await page.locator(".announcement__track").evaluate((track) => getComputedStyle(track).animationName)).toBe("none");
  await expect(page.getByRole("link", { name: "Complimentary UK delivery on orders over £80" })).toBeVisible();
  const staticMessage = page.locator(".announcement__message:visible");
  await expect(staticMessage).toHaveCount(1);
  const staticBounds = await staticMessage.boundingBox();
  expect(staticBounds?.width).toBeLessThanOrEqual(320);
  const heroAnimations = await page.locator(".hero").evaluate((hero) => hero.getAnimations({ subtree: true }).length);
  expect(heroAnimations).toBe(0);
});

test("delivery announcement can be paused, resumed, and held while reading", async ({ page }) => {
  await page.goto("/");
  await page.mouse.move(2, 180);
  const track = page.locator(".announcement__track");
  const playState = () => track.evaluate((element) => getComputedStyle(element).animationPlayState);
  await expect.poll(playState).toBe("running");

  await page.getByRole("button", { name: "Pause delivery announcement" }).click();
  await expect.poll(playState).toBe("paused");
  await page.getByRole("button", { name: "Resume delivery announcement" }).click();
  await expect.poll(playState).toBe("running");

  const offer = page.getByRole("link", { name: "Complimentary UK delivery on orders over £80" });
  await offer.hover();
  await expect.poll(playState).toBe("paused");
  await page.mouse.move(2, 180);
  await offer.focus();
  await expect.poll(playState).toBe("paused");
});

test("button and navigation hover effects preserve labels and layout", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await settleHero(page);

  const button = page.locator(".hero").getByRole("link", { name: "Explore the collection" });
  const buttonBounds = await button.boundingBox();
  await button.hover();
  await expect.poll(() => button.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(23, 23, 23)");
  expect(await button.boundingBox()).toEqual(buttonBounds);
  await expect(button).toHaveAccessibleName("Explore the collection");
  await page.screenshot({ path: testInfo.outputPath("button-hover.png") });

  const collection = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Collection", exact: true });
  const navigationBounds = await collection.boundingBox();
  await collection.hover();
  await expect.poll(() => collection.locator(".nav-label__original").evaluate((element) => getComputedStyle(element).transform))
    .not.toBe("none");
  expect(await collection.boundingBox()).toEqual(navigationBounds);
  await expect(collection).toHaveAccessibleName("Collection");
});

test("touch users can control the banner and mobile menu", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Pause delivery announcement" }).tap();
    await expect(page.getByRole("button", { name: "Resume delivery announcement" })).toBeVisible();
    await page.getByRole("button", { name: "Open navigation menu" }).tap();
    await expect(page.getByRole("dialog", { name: "Explore SEEN" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation menu" }).tap();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  } finally {
    await context.close();
  }
});

test("desktop photographs flip on hover and can be changed with the keyboard", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await settleHero(page);
  const photo = page.getByRole("button", { name: "Alternate view of Botanical detailing", exact: true });
  const bounds = await photo.boundingBox();
  await photo.hover();
  await expect(photo).toHaveAttribute("aria-pressed", "true");
  await expect(photo.locator('[aria-hidden="false"] img')).toHaveAttribute("alt", /Back view of the black abaya/);
  await expect.poll(() => photo.locator(".flip-photo__inner").evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await photo.locator(".flip-photo__inner").evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished)); });
  expect(await photo.boundingBox()).toEqual(bounds);
  await page.screenshot({ path: testInfo.outputPath("hero-flip.png") });
  await page.mouse.move(2, 180);
  await expect(photo).toHaveAttribute("aria-pressed", "false");
  await photo.focus();
  await page.keyboard.press("Enter");
  await expect(photo).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(2, 180);
  await expect(photo).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(photo).toHaveAttribute("aria-pressed", "false");
});

test("gallery shows actual views, supports arrows and thumbnails, and restores focus", async ({ page }, testInfo) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "View photographs: Burgundy", exact: true });
  await trigger.click();
  const gallery = page.getByRole("dialog", { name: "Burgundy", exact: true });
  const close = gallery.getByRole("button", { name: "Close photo gallery" });
  await expect(close).toBeFocused();
  await expect(gallery.getByRole("status")).toHaveText("Front1 / 4");
  await page.keyboard.press("ArrowRight");
  await expect(gallery.getByRole("status")).toHaveText("Back2 / 4");
  await gallery.getByRole("button", { name: "Show details photograph", exact: true }).click();
  await expect(gallery.getByRole("status")).toHaveText("Details3 / 4");
  await expect(gallery.locator(".gallery-photo")).toHaveAttribute("alt", /Covered buttons/);
  await gallery.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(gallery.getByRole("status")).toHaveText("Another angle4 / 4");
  await page.keyboard.press("ArrowRight");
  await expect(gallery.getByRole("status")).toHaveText("Front1 / 4");
  await page.keyboard.press("ArrowLeft");
  await expect(gallery.getByRole("status")).toHaveText("Another angle4 / 4");
  for (let step = 0; step < 12; step++) {
    await page.keyboard.press("Tab");
    expect(await gallery.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await expect.poll(() => gallery.locator(".gallery-photo").evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("photo-gallery.png") });
  await page.keyboard.press("Escape");
  await expect(gallery).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("collection reveals seven photo groups and single-photo galleries have no redundant controls", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".collection-card");
  await expect(cards).toHaveCount(4);
  await page.getByRole("button", { name: "View more pieces" }).click();
  await expect(cards).toHaveCount(7);
  const trigger = page.getByRole("button", { name: "View photographs: Textured charcoal", exact: true });
  await trigger.click();
  const gallery = page.getByRole("dialog", { name: "Textured charcoal", exact: true });
  await expect(gallery.getByRole("status")).toHaveText("Front1 / 1");
  await expect(gallery.getByRole("button", { name: "Next photo" })).toHaveCount(0);
  await expect(gallery.locator(".gallery-thumbnails")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(gallery.getByRole("status")).toHaveText("Front1 / 1");
  await gallery.getByRole("button", { name: "Close photo gallery" }).click();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Show fewer pieces" }).click();
  await expect(cards).toHaveCount(4);
});

test("touch lookbook supports paging, native swipes, tap views, and gallery swipes", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await settleHero(page);
    const controls = page.locator(".lookbook-controls");
    await controls.getByRole("button", { name: "Next featured photograph" }).tap();
    await expect(controls.getByRole("status")).toHaveText("02 / 03");
    const photo = page.getByRole("button", { name: "Alternate view of Botanical detailing", exact: true });
    await photo.tap();
    await expect(photo).toHaveAttribute("aria-pressed", "true");
    await photo.tap();
    await expect(photo).toHaveAttribute("aria-pressed", "false");

    const cdp = await context.newCDPSession(page);
    async function swipe(selector: string) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      const bounds = (await page.locator(selector).boundingBox())!;
      const x = Math.min(bounds.x + bounds.width - 35, 350);
      const y = Math.min(bounds.y + bounds.height / 2, 660);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - step * 28, y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await swipe(".hero-lookbook");
    await expect(controls.getByRole("status")).toHaveText("03 / 03");
    await page.screenshot({ path: testInfo.outputPath("mobile-lookbook.png") });

    await page.getByRole("button", { name: "View photographs: Burgundy", exact: true }).tap();
    const gallery = page.getByRole("dialog", { name: "Burgundy", exact: true });
    await swipe(".gallery-stage");
    await expect(gallery.getByRole("status")).toHaveText("Back2 / 4");
    await gallery.getByRole("button", { name: "Close photo gallery" }).tap();
    await expect(gallery).not.toBeVisible();
  } finally {
    await context.close();
  }
});

test("reduced motion retains alternate views without a flip transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const photo = page.getByRole("button", { name: "Alternate view of Burgundy", exact: true });
  await photo.focus();
  await page.keyboard.press("Enter");
  await expect(photo).toHaveAttribute("aria-pressed", "true");
  expect(await photo.locator(".flip-photo__inner").evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await expect(photo.locator('.flip-photo__face[aria-hidden="true"]')).not.toBeVisible();
  await expect(photo.locator('.flip-photo__face[aria-hidden="false"]')).toBeVisible();
});
