import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function openFilm(page: Page) {
  await page.goto("/");
  await expect(page.locator(".film-hero")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
}

async function assertDocked(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const logo = document
          .querySelector(".film-floating-logo")!
          .getBoundingClientRect();
        const target = document
          .querySelector(".site-header .brand-logo")!
          .getBoundingClientRect();
        return Math.max(
          Math.abs(logo.width - target.width),
          Math.abs(logo.height - target.height),
          Math.abs(logo.x + logo.width / 2 - target.x - target.width / 2),
          Math.abs(logo.y + logo.height / 2 - target.y - target.height / 2),
        );
      }),
    )
    .toBeLessThan(3);
  await expect
    .poll(() =>
      page
        .locator(".site-header")
        .evaluate((header) => getComputedStyle(header).backgroundColor),
    )
    .toBe("rgb(255, 255, 255)");
  await expect(page.locator(".site-header")).toHaveCSS(
    "color",
    "rgb(23, 23, 23)",
  );
  await expect(page.locator(".header-inner")).toHaveCSS("opacity", "1");
  await expect(page.locator(".header-inner")).toHaveCSS(
    "visibility",
    "visible",
  );
}

async function assertTransparent(page: Page) {
  await expect
    .poll(() =>
      page
        .locator(".site-header")
        .evaluate((header) => getComputedStyle(header).backgroundColor),
    )
    .toBe("rgba(255, 255, 255, 0)");
  await expect(page.locator(".site-header")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".bag-trigger")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  if (page.viewportSize()!.width < 1024) {
    await expect(page.locator(".header-inner")).toHaveCSS("opacity", "0");
    await expect(
      page.getByRole("button", { name: "Open navigation menu", exact: true }),
    ).not.toBeVisible();
    await expect(page.locator(".announcement")).toBeVisible();
  }
}

async function freezeFilm(page: Page, time = 1) {
  await page.locator("video").evaluate((video: HTMLVideoElement, time) => {
    video.pause();
    video.currentTime = time;
  }, time);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate(
          (video: HTMLVideoElement) => !video.seeking && video.readyState >= 2,
        ),
    )
    .toBe(true);
}

for (const [width, height] of [
  [320, 568],
  [320, 740],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [844, 390],
]) {
  test(
    "full homepage film and non-overlapping branding at " +
      width +
      "x" +
      height,
    async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height });
      await openFilm(page);
      await assertTransparent(page);
      await expect(
        page.locator(
          ".development-notice, .hero-preview-switch, .film-playback",
        ),
      ).toHaveCount(0);
      await expect(page.locator(".film-hero button")).toHaveCount(0);
      await expect(page.getByText("Hero study:", { exact: false })).toHaveCount(
        0,
      );
      await expect
        .poll(() =>
          page
            .locator("video")
            .evaluate((video: HTMLVideoElement) => video.videoWidth),
        )
        .toBe(1280);
      await expect(page.locator(".film-hero")).toHaveAttribute(
        "data-has-frame",
        "true",
      );
      expect(
        await page
          .locator("video")
          .evaluate(
            (video: HTMLVideoElement) =>
              video.muted && video.playsInline && video.loop && !video.controls,
          ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const geometry = await page.evaluate(() => {
        const logo = document
          .querySelector(".film-floating-logo")!
          .getBoundingClientRect();
        const copy = document
          .querySelector(".film-hero__caption")!
          .getBoundingClientRect();
        const hero = document
          .querySelector(".film-hero")!
          .getBoundingClientRect();
        const navigation = document
          .querySelector(".header-inner")!
          .getBoundingClientRect();
        return {
          width: logo.width,
          overlap:
            logo.left < copy.right &&
            logo.right > copy.left &&
            logo.top < copy.bottom &&
            logo.bottom > copy.top,
          copyLeft: copy.left,
          heroBottom: hero.bottom,
          heroTop: hero.top,
          navTop: navigation.top,
        };
      });
      expect(geometry.overlap).toBe(false);
      expect(geometry.copyLeft).toBeLessThan(width * 0.1);
      expect(geometry.heroBottom).toBeLessThanOrEqual(height + 2);
      expect(Math.abs(geometry.heroTop - geometry.navTop)).toBeLessThan(2);
      await freezeFilm(page);
      if ([390, 1440, 844].includes(width))
        await page.screenshot({
          path: testInfo.outputPath("film-" + width + ".png"),
        });
      await page.evaluate(() =>
        window.scrollTo({ top: 850, behavior: "instant" }),
      );
      await assertDocked(page);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: testInfo.outputPath("logo-in-navbar-" + width + ".png"),
        });
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await expect
        .poll(
          async () =>
            (await page.locator(".film-floating-logo").boundingBox())!.width,
        )
        .toBeGreaterThan(geometry.width - 2);
      await assertTransparent(page);
      expect(errors).toEqual([]);
    },
  );
}

test("rotation and client navigation restore the supplied navbar logo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFilm(page);
  await page.evaluate(() => window.scrollTo({ top: 850, behavior: "instant" }));
  await assertDocked(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertDocked(page);
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = page.getByRole("dialog", { name: "Explore SEEN" });
  await menu.getByRole("link", { name: "Collection", exact: true }).click();
  await expect(page).toHaveURL(/\/collection$/);
  await expect(page.locator(".film-floating-logo")).toHaveCount(0);
  await expect(page.locator(".site-header .brand-logo")).toBeVisible();
  await expect(page.locator(".site-header")).toHaveCSS("position", "sticky");
  await expect(page.locator(".site-header")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  expect(
    await page
      .locator(".brand-logo__art")
      .first()
      .evaluate((element) => getComputedStyle(element).maskImage),
  ).toContain("seen-signature.svg");
  await page.goto("/");
  await expect(page.locator(".film-hero")).toBeVisible();
});

test("reduced motion uses a still and a static navbar logo without downloading the video", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const mediaRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("hero.mp4")) mediaRequests.push(request.url());
  });
  await openFilm(page);
  await assertDocked(page);
  expect(mediaRequests).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertDocked(page);
  await expect(page.locator(".film-hero")).toHaveAttribute(
    "data-has-frame",
    "false",
  );
});

test("the data-saving flag does not introduce a Play button or disable requested autoplay", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    });
  });
  await openFilm(page);
  await expect(page.locator(".film-hero")).toHaveAttribute(
    "data-has-frame",
    "true",
  );
  await expect(page.locator(".film-hero button")).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0,
        ),
    )
    .toBe(true);
});

test.describe("touch viewport", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  test("touch navigation and offscreen playback remain functional", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await openFilm(page);
    await expect(page.locator(".film-hero")).toHaveAttribute(
      "data-has-frame",
      "true",
    );
    await page.evaluate(() =>
      window.scrollTo({ top: 1400, behavior: "instant" }),
    );
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(false);
    for (const time of [2.7, 7.7]) {
      await freezeFilm(page, time);
      await page.screenshot({
        path: testInfo.outputPath("touch-film-" + time + ".png"),
      });
    }
    await page.evaluate(() =>
      window.scrollTo({ top: 850, behavior: "instant" }),
    );
    await assertDocked(page);
    await page.getByRole("button", { name: "Open navigation menu" }).tap();
    await expect(
      page.getByRole("dialog", { name: "Explore SEEN" }),
    ).toBeVisible();
  });
});

test("a failed film leaves the still image and collection link usable", async ({
  page,
}) => {
  await page.route("**/videos/home/hero.mp4", (route) => route.abort());
  await openFilm(page);
  await expect(page.locator(".film-hero")).toHaveAttribute(
    "data-has-frame",
    "false",
  );
  await expect(page.locator(".film-hero__poster")).toBeVisible();
  await page.locator(".film-hero__shop").click();
  await expect(page).toHaveURL(/\/collection$/);
});

for (const width of [390, 1440]) {
  test(
    "hero contrast, semantics and homepage metadata at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("/");
      expect(response!.headers()["content-security-policy"]).toContain(
        "media-src 'self'",
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(page.locator(".film-hero")).toHaveAttribute(
        "data-has-frame",
        "true",
      );
      await freezeFilm(page);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    },
  );
}
