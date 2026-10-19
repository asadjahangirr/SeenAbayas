import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
});

test("Android touch: film plays, navigation opens and a product can be added, updated and removed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const video = page.locator(".film-hero video");
  await expect
    .poll(() =>
      video.evaluate(
        (el: HTMLVideoElement) => !el.paused && el.currentTime > 0,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Open navigation menu", exact: true })
    .tap();
  const menu = page.getByRole("dialog", { name: "Explore SEEN", exact: true });
  await menu.getByRole("link", { name: "Collection", exact: true }).tap();
  await expect(menu).not.toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search the collection" });
  await search.fill("r");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await page.locator(".catalog-card__image").tap();
  await page.getByRole("button", { name: "Add to bag", exact: true }).tap();
  await expect(
    page.locator(".piece-purchase").getByRole("alert"),
  ).toContainText("choose an available size");
  await page.getByRole("button", { name: "54", exact: true }).tap();
  await page.getByRole("button", { name: "Add to bag", exact: true }).tap();
  const bag = page.getByRole("dialog", { name: /^Your bag/ });
  await expect(bag).toBeVisible();
  await bag
    .getByRole("button", { name: "Increase quantity", exact: true })
    .tap();
  await expect(
    page.getByRole("button", {
      name: "Open shopping bag, 2 items",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await bag
    .getByRole("button", { name: "Decrease quantity", exact: true })
    .tap();
  await bag
    .getByRole("button", { name: "Close shopping bag", exact: true })
    .tap();
  await page
    .getByRole("button", { name: "Open shopping bag, 1 item", exact: true })
    .tap();
  await bag.getByRole("link", { name: /View.*bag/i }).tap();
  await expect(page).toHaveURL(/\/bag$/);
  await page.reload();
  await expect(page.locator(".bag-page .bag-line")).toHaveCount(1);
  await page.getByRole("button", { name: /^Remove Layla/ }).tap();
  await expect(page.locator(".bag-page .bag-empty")).toBeVisible();
  expect(errors).toEqual([]);
});

test("older Android browsers can add and restore a bag without newer AbortSignal APIs", async ({
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
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "54", exact: true }).tap();
  await page.getByRole("button", { name: "Add to bag", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: /^Your bag/ })).toBeVisible();
  await page.goto("/bag");
  await page.reload();
  await expect(page.locator(".bag-page .bag-subtotal strong")).toHaveText(
    "£75.00",
  );
});

test("blocked autoplay offers a working one-tap play recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let allowed = false;
    document.addEventListener("click", (event) => {
      if (event.isTrusted && event.target instanceof Element && event.target.closest(".film-playback-recovery")) allowed = true;
    }, true);
    HTMLMediaElement.prototype.play = function () {
      if (!allowed) {
        this.pause();
        return Promise.reject(
          new DOMException("Autoplay blocked", "NotAllowedError"),
        );
      }
      return play.call(this);
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Play campaign film", exact: true })
    .tap();
  await expect
    .poll(() =>
      page
        .locator(".film-hero video")
        .evaluate((el: HTMLVideoElement) => !el.paused && el.currentTime > 0),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Play campaign film", exact: true }),
  ).not.toBeVisible();
});

test("data-saving phones can choose to play the film without an automatic download", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    }),
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("hero.mp4")) requests.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play campaign film", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  await page
    .getByRole("button", { name: "Play campaign film", exact: true })
    .tap();
  await expect
    .poll(() =>
      page
        .locator(".film-hero video")
        .evaluate((el: HTMLVideoElement) => !el.paused && el.currentTime > 0),
    )
    .toBe(true);
});

test("phone gallery supports swipes, tap magnification, arrows and the size-guide dialog", async ({
  page,
  context,
}) => {
  await page.goto("/collection/design-01");
  const photo = page.locator(".piece-photo");
  await photo.scrollIntoViewIfNeeded();
  const rect = (await photo.boundingBox())!;
  const x = rect.x + rect.width - 35;
  const y = Math.max(220, Math.min(rect.y + rect.height / 2, 650));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 8; step++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - step * 28, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".piece-gallery__meta")).toContainText("2 / 4");
  await photo.tap();
  await expect(photo).toHaveAttribute("data-zoomed", "true");
  await photo.tap();
  await expect(photo).toHaveAttribute("data-zoomed", "false");
  await page
    .getByRole("button", { name: "Next product photograph", exact: true })
    .tap();
  await expect(page.locator(".piece-gallery__meta")).toContainText("3 / 4");
  await page.getByRole("button", { name: "Size guide", exact: true }).tap();
  const guide = page.getByRole("dialog", { name: "Size Guide", exact: true });
  await expect(guide).toBeVisible();
  expect(await guide.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    false,
  );
  await guide
    .getByRole("button", { name: "Close size guide", exact: true })
    .tap();
  await expect(guide).not.toBeVisible();
});

test("a failed bag request can be retried and rapid taps cannot add duplicate items", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/bag", async (route) => {
    requests++;
    if (requests === 1)
      await route.fulfill({
        status: 503,
        json: { error: "Temporary failure" },
      });
    else {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    }
  });
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "54", exact: true }).tap();
  const add = page.getByRole("button", { name: "Add to bag", exact: true });
  await add.tap();
  await expect(page.locator(".purchase-error")).toContainText("couldn't check");
  await add.tap();
  await page
    .locator(".purchase-button")
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole("dialog", { name: /^Your bag/ })).toBeVisible();
  expect(requests).toBe(2);
  await expect(
    page.getByRole("button", {
      name: "Open shopping bag, 1 item",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("film resumes after a phone page restoration and pauses offscreen", async ({
  page,
}) => {
  await page.goto("/");
  const video = page.locator(".film-hero video");
  await expect
    .poll(() =>
      video.evaluate(
        (el: HTMLVideoElement) => !el.paused && el.currentTime > 0,
      ),
    )
    .toBe(true);
  await video.evaluate((el: HTMLVideoElement) => el.pause());
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.paused))
    .toBe(false);
  await page.evaluate(() =>
    window.scrollTo({ top: 1600, behavior: "instant" }),
  );
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.paused))
    .toBe(true);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 393, height: 851 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
]) {
  test(`public pages fit and remain usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const paths =
      viewport.height < 500
        ? ["/", "/collection", "/collection/design-01", "/bag"]
        : [
            "/",
            "/collection",
            "/collection/design-01",
            "/bag",
            "/our-story",
            "/contact",
            "/size-guide",
            "/faqs",
            "/shipping-delivery",
            "/returns-exchanges",
            "/privacy-policy",
            "/terms-conditions",
            "/cookie-policy",
          ];
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("main h1"), path).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        path,
      ).toBe(false);
      if (
        viewport.width === 393 &&
        ["/", "/collection/design-01", "/contact"].includes(path)
      ) {
        await page.screenshot({
          path: testInfo.outputPath(
            `${path.replaceAll("/", "-") || "home"}.png`,
          ),
          fullPage: true,
        });
        const audit = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(audit.violations, path).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  });
}
