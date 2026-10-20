import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function settleHero(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".film-hero")).toHaveAttribute("data-motion-ready", "true");
}

for (const width of [320, 375, 768, 1024, 1440, 1920]) {
  test("responsive film homepage and supplied media at " + width + "px", async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await settleHero(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Made to\s*Be Seen\./);
    await expect(page.locator(".film-hero video")).toHaveCount(1);
    await expect(page.locator(".hero-lookbook")).toHaveCount(0);
    const poster = page.locator(".film-hero__poster");
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator(".collection-card")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
    if (width === 320 || width === 1440) await page.screenshot({ path: testInfo.outputPath("hero-" + width + ".png") });
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
  await expect(page).toHaveURL(/\/our-story$/);
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
      if (url.origin === window.location.origin && (["/", "/collection", "/bag", "/our-story", "/contact", "/size-guide", "/faqs", "/shipping-delivery", "/returns-exchanges", "/privacy-policy", "/terms-conditions", "/cookie-policy"].includes(url.pathname) || /^\/collection\/design-[0-9]{2,4}$/.test(url.pathname)) && !url.hash) return [];
      if (url.origin !== window.location.origin || url.pathname !== "/") return [href];
      return url.hash && document.getElementById(url.hash.slice(1)) ? [] : [href];
    }),
  );
  expect(invalidLinks).toEqual([]);
  expect((await request.get("/collection")).status()).toBe(200);
  expect((await request.get("/bag")).status()).toBe(200);
  for (const path of await page.locator(".collection-card__open").evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) expect((await request.get(path)).status()).toBe(200);
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

    await page.locator(".collection-card").getByRole("link", { name: "View piece: Burgundy", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Burgundy");
    await expect(page.getByRole("button", { name: "Add to bag", exact: true })).toBeDisabled();
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
  await expect(page.getByRole("link", { name: "Complimentary UK delivery on orders of £80 or more" })).toBeVisible();
  const staticMessage = page.locator(".announcement__message:visible");
  await expect(staticMessage).toHaveCount(1);
  const staticBounds = await staticMessage.boundingBox();
  expect(staticBounds?.width).toBeLessThanOrEqual(320);
  const heroAnimations = await page.locator(".film-hero").evaluate((hero) => hero.getAnimations({ subtree: true }).length);
  expect(heroAnimations).toBe(0);
});

test("delivery announcement has no pause button and holds on hover or keyboard focus", async ({ page }) => {
  await page.goto("/");
  await page.mouse.move(2, 180);
  const track = page.locator(".announcement__track");
  const playState = () => track.evaluate((element) => getComputedStyle(element).animationPlayState);
  await expect.poll(playState).toBe("running");

  await expect(page.locator(".announcement button")).toHaveCount(0);
  expect(await page.locator(".announcement__viewport").evaluate((element) => Math.abs(element.getBoundingClientRect().width - innerWidth))).toBeLessThan(2);

  const offer = page.getByRole("link", { name: "Complimentary UK delivery on orders of £80 or more" });
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

  const button = page.locator(".film-hero__shop");
  const buttonBounds = await button.boundingBox();
  await button.hover();
  await expect.poll(() => button.evaluate((element) => getComputedStyle(element, "::after").transform)).toBe("matrix(1, 0, 0, 1, 0, 0)");
  expect(await button.boundingBox()).toEqual(buttonBounds);
  await expect(button).toHaveAccessibleName("Discover the collection");
  await page.screenshot({ path: testInfo.outputPath("button-hover.png") });

  const collection = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Collection", exact: true });
  const navigationBounds = await collection.boundingBox();
  await collection.hover();
  await expect.poll(() => collection.locator(".nav-label__original").evaluate((element) => getComputedStyle(element).transform))
    .not.toBe("none");
  expect(await collection.boundingBox()).toEqual(navigationBounds);
  await expect(collection).toHaveAccessibleName("Collection");
});

test("touch users can open the delivery page and mobile menu without a banner button", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".announcement button")).toHaveCount(0);
    await page.locator(".announcement__viewport").tap();
    await expect(page).toHaveURL(/\/shipping-delivery$/);
    await page.getByRole("button", { name: "Open navigation menu" }).tap();
    await expect(page.getByRole("dialog", { name: "Explore SEEN" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation menu" }).tap();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  } finally {
    await context.close();
  }
});




test("home edit remains four pieces and the collection contains all seven", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".collection-card")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /View more pieces|Show fewer pieces/ })).toHaveCount(0);
  await page.locator(".collection-more").getByRole("link", { name: "Explore the collection" }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.locator(".catalog-card")).toHaveCount(9);
  await expect(page.locator(".catalog-intro img")).toHaveCount(0);
});
