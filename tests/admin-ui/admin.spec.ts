import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Test-password-only-123");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
});
test("API requires MFA, uses HttpOnly cookies and clears access on sign-out", async ({
  request,
  browser,
}) => {
  const options = { headers: { Origin: "http://127.0.0.1:3107" } };
  expect(
    (
      await request.post("/api/admin/auth", {
        ...options,
        data: {
          action: "login",
          email: "owner@example.test",
          password: "Test-password-only-123",
        },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/admin")).status()).toBe(403);
  const state = await request.storageState();
  expect(
    state.cookies
      .filter((c) => c.name.includes("auth-token"))
      .every((c) => c.httpOnly && c.sameSite === "Lax"),
  ).toBe(true);
  const profile = await (await request.get("/api/admin/auth")).json();
  expect(
    (
      await request.post("/api/admin/auth", {
        ...options,
        data: {
          action: "verify",
          factorId: profile.factors[0].id,
          code: "000000",
        },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/admin/auth", {
        ...options,
        data: {
          action: "verify",
          factorId: profile.factors[0].id,
          code: "123456",
        },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/admin")).status()).toBe(200);
  expect((await request.get("/admin")).status()).toBe(200);
  const anonymous = await browser.newContext();
  expect(
    (await anonymous.request.get("/admin", { maxRedirects: 0 })).status(),
  ).toBe(307);
  await anonymous.close();
  await request.post("/api/admin/auth", {
    ...options,
    data: { action: "logout" },
  });
  expect((await request.get("/api/admin")).status()).toBe(401);
});
test("admin data is inaccessible before login and cross-origin writes are rejected", async ({
  page,
  request,
}) => {
  const r = await request.get("/api/admin");
  expect(r.status()).toBe(401);
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
  expect(await page.locator(".site-header").count()).toBe(0);
  const rejected = await request.post("/api/admin", {
    headers: { Origin: "https://outside.example" },
    data: { action: "site" },
  });
  expect(rejected.status()).toBe(403);
});
test("sign in requires MFA, then every admin section opens", async ({
  page,
}) => {
  await signIn(page);
  for (const [slug, title] of [
    ["products", "Products & stock"],
    ["categories", "Categories"],
    ["orders", "Orders"],
    ["inbox", "Inbox"],
    ["finance", "Finance"],
    ["coupons", "Coupons"],
    ["hero", "Hero video"],
    ["media", "Media library"],
    ["content", "Website text"],
    ["appearance", "Appearance & motion"],
    ["settings", "Store settings"],
    ["history", "History & activity"],
    ["security", "Account & security"],
  ]) {
    await page.goto(`/admin/${slug}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true, level: 1 }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
});
test("copy edits stay in draft until published and appear on the storefront", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/content");
  await page
    .getByRole("searchbox", { name: "Search website text" })
    .fill("Made to");
  const field = page.getByRole("textbox", {
    name: "Replacement for Made to",
    exact: true,
  });
  await field.fill("Created to");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: false })).toBeVisible();
  const shop = await page.context().newPage();
  await shop.goto("/");
  await expect(shop.locator("#film-title")).toHaveText("Made to Be Seen.");
  await shop.close();
  await page.getByRole("button", { name: "Save & update store" }).click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.locator("#film-title")).toHaveText("Created to Be Seen.");
});
test("product stock, categories, coupons and expenses persist", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/products");
  await page
    .locator(".admin-product-row")
    .first()
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("TEST Edited Abaya");
  await page.getByLabel("On hand", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Save & show in store", exact: true })
    .click();
  await expect(
    page.getByText("Product saved.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("TEST Edited Abaya", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/categories");
  await page.getByText("Add category", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Evening");
  await page.getByLabel("Slug", { exact: true }).fill("evening");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(page.getByText("Evening", { exact: true })).toBeVisible();
  await page.goto("/admin/coupons");
  await page.getByText("Add coupon", { exact: true }).click();
  await page.getByLabel("Coupon code").fill("WELCOME10");
  await page.getByRole("button", { name: "Save coupon", exact: true }).click();
  await expect(page.getByText("WELCOME10", { exact: true })).toBeVisible();
  await page.goto("/admin/finance");
  await page.getByText("Add expense", { exact: true }).click();
  await page.getByLabel("Expense title").fill("Test packaging");
  await page.getByLabel("Amount (£)").fill("12.50");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByText("Test packaging", { exact: true })).toBeVisible();
});
test("order fulfilment and inbox read state persist", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/orders");
  await page.locator("summary").filter({ hasText: "TEST-1001" }).click();
  await page.getByLabel("Fulfilment status").selectOption("shipped");
  await page
    .getByLabel("Royal Mail / courier tracking reference")
    .fill("TEST-TRACK-123");
  await page.getByRole("button", { name: "Save fulfilment details" }).click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  await page.reload();
  await page.locator("summary").filter({ hasText: "TEST-1001" }).click();
  await expect(page.getByLabel("Fulfilment status")).toHaveValue("shipped");
  await page.goto("/admin/inbox");
  await page.locator(".admin-record summary").click();
  await page.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark unread", exact: true }),
  ).toBeVisible();
});
for (const width of [320, 390, 768, 1024, 1440])
  test(`workspace is responsive and accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto("/admin/products");
    await page
      .getByRole("checkbox", {
        name: "Select all matching products",
        exact: true,
      })
      .check();
    await page
      .getByRole("checkbox", {
        name: "Select Layla Burgundy Abaya",
        exact: true,
      })
      .uncheck();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 900) {
      await page.getByRole("button", { name: "Open admin navigation" }).click();
      await expect(
        page.getByRole("navigation", { name: "Administration" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close navigation", exact: true })
        .click();
      await expect
        .poll(() =>
          page
            .locator(".admin-sidebar")
            .evaluate((el) => el.getBoundingClientRect().right),
        )
        .toBeLessThanOrEqual(0);
    }
    await page.screenshot({
      path: `test-results/admin-${width}.png`,
      fullPage: true,
    });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });

test("first owner enrols an authenticator before opening the workspace", async ({
  page,
  request,
}) => {
  await request.get("http://127.0.0.1:3106/__test/reset?enroll=1");
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Test-password-only-123");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(
    page.getByAltText("Scan this QR code in your authenticator"),
  ).toBeVisible();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Overview" }),
  ).toBeVisible();
});

test("uploaded media stays private until the hero is published", async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto("/admin/media");
  await page.getByLabel("Upload media").setInputFiles({
    name: "poster.webp",
    mimeType: "image/webp",
    buffer: await readFile("public/images/home/hero-poster.webp"),
  });
  await expect(
    page.getByText("File uploaded privately.", { exact: false }),
  ).toBeVisible();
  const poster = await page
    .getByAltText("Uploaded library asset")
    .getAttribute("src");
  expect(poster).toMatch(/^\/api\/media\//);
  expect((await request.get(poster!)).status()).toBe(404);
  await page.getByLabel("Upload media").setInputFiles({
    name: "hero.mp4",
    mimeType: "video/mp4",
    buffer: await readFile("public/videos/home/hero.mp4"),
  });
  await expect(
    page.locator(".admin-panel").first().locator(".admin-asset-card"),
  ).toHaveCount(2);
  const clip = await page
    .locator(".admin-panel")
    .first()
    .locator("video")
    .getAttribute("src");
  expect(clip).toMatch(/^\/api\/media\//);
  await page.goto("/admin/hero");
  await page
    .getByRole("combobox", { name: "Select image" })
    .selectOption(poster!);
  await page
    .getByRole("combobox", { name: "Select video" })
    .selectOption(clip!);
  await page
    .getByLabel("Collection button destination")
    .fill("/collection?sort=az");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: false })).toBeVisible();
  expect((await request.get(poster!)).status()).toBe(404);
  await page.getByRole("button", { name: "Save & update store" }).click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  expect((await request.get(poster!)).status()).toBe(200);
  expect((await request.get(clip!)).status()).toBe(200);
  await page.goto("/");
  await expect(page.locator(".film-hero video")).toHaveAttribute("src", clip!);
  await expect(page.locator(".film-hero__shop")).toHaveAttribute(
    "href",
    "/collection?sort=az",
  );
});

test("private preview follows customer routes and includes unpublished products", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  expect(
    (
      await request.get("/admin/preview/collection", { maxRedirects: 0 })
    ).status(),
  ).toBe(307);
  await signIn(page);
  await page.goto("/admin/preview/collection");
  await expect(
    page.getByRole("heading", { level: 1, name: "The Collection" }),
  ).toBeVisible();
  await expect(page.locator(".catalog-card")).toHaveCount(7);
  const piece = page.getByRole("link", {
    name: "View piece: Amal Neutral Abaya",
    exact: true,
  });
  await expect(piece).toHaveAttribute(
    "href",
    "/admin/preview/collection/design-07",
  );
  await Promise.all([
    page.waitForURL("**/admin/preview/collection/design-07", {
      timeout: 15_000,
    }),
    piece.click(),
  ]);
  await expect(page.locator(".piece-information .purchase-hint")).toBeVisible();
  expect(
    await page.getByRole("button", { name: "Add to bag", exact: true }).count(),
  ).toBe(0);
  await page.goto("/admin/preview/shipping-delivery");
  await expect(
    page.getByRole("heading", { level: 1, name: "Shipping & Delivery" }),
  ).toBeVisible();
});

test("password recovery exchanges a PKCE code and still requires the authenticator", async ({
  page,
}) => {
  await page.goto("/admin/recover");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByRole("button", { name: "Request recovery link" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "If this address is registered" }),
  ).toBeVisible();
  await page.goto("/admin/auth/callback?code=test-recovery-code");
  await expect(page).toHaveURL(/\/admin\/recover\?stage=password/);
  await page
    .getByLabel("New password", { exact: true })
    .fill("New-test-password-for-seen-123");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("New-test-password-for-seen-123");
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Reset password securely" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("login email changes require the current password and a fresh authenticator code", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/security");
  const panel = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Change login email",
      exact: true,
    }),
  });
  await panel.getByLabel("New login email").fill("new-owner@example.test");
  await panel.getByLabel("Current password").fill("Test-password-only-123");
  await panel.getByLabel("Authenticator code").fill("123456");
  await panel.getByRole("button", { name: "Request email change" }).click();
  await expect(panel.getByRole("status")).toContainText(
    "Confirmation requested.",
  );
});

test("published delivery settings and conditional copy survive bag removals", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/admin/products");
  await page
    .locator(".admin-product-row")
    .filter({ hasText: "Zahra Botanical Abaya" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Store visibility", exact: true })
    .selectOption("published");
  await page
    .getByRole("button", { name: "Save & show in store", exact: true })
    .click();
  await expect(
    page.getByText("Product saved.", { exact: false }),
  ).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByLabel("Free delivery threshold (£)").fill("90");
  await page.getByRole("button", { name: "Save & update store" }).click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  await page.goto("/admin/content");
  await page
    .getByRole("searchbox", { name: "Search website text" })
    .fill("Your selection qualifies");
  await page
    .getByRole("textbox", {
      name: "Replacement for Your selection qualifies for complimentary standard UK delivery.",
      exact: true,
    })
    .fill("Your bag is ready for complimentary delivery.");
  await page.getByRole("button", { name: "Save & update store" }).click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  for (const design of ["design-02", "design-01"]) {
    await page.goto(`/collection/${design}`);
    await page.getByRole("button", { name: "54", exact: true }).click();
    await page.getByRole("button", { name: "Add to bag", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /^Your bag/ })).toBeVisible();
  }
  await page.goto("/bag");
  await expect(page.locator("main .bag-delivery")).toContainText(
    "Your bag is ready for complimentary delivery.",
  );
  await page
    .locator("main")
    .getByRole("button", {
      name: "Remove Layla Burgundy Abaya, size 54",
      exact: true,
    })
    .click();
  await expect(page.locator("main .bag-subtotal strong")).toHaveText("£85.00");
  await expect(page.locator("main .bag-delivery")).toContainText("Add £5.00");
  await expect(page.locator("main .bag-delivery")).toContainText("of £90 or more");
});

test("new products and empty categories reach an already open independent storefront", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/collection");
  await shop
    .getByRole("searchbox", { name: "Search the collection" })
    .fill("New arrival");
  await signIn(page);
  await page.goto("/admin/categories");
  await page.getByText("Add category", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Evening pieces");
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(
    "evening-pieces",
  );
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  await expect(
    shop
      .getByRole("combobox", { name: "Category", exact: true })
      .locator("option"),
  ).toContainText(["All categories", "Evening pieces"], { timeout: 15000 });
  await shop
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("evening-pieces");
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("New arrival silk abaya");
  await page.getByLabel("Price (£)", { exact: true }).fill("85.99");
  await page
    .getByLabel("Description", { exact: true })
    .fill("An elegant test piece with flowing sleeves.");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("evening-pieces");
  await page.getByLabel("On hand", { exact: true }).first().fill("5");
  await page
    .getByLabel("Upload product photographs", { exact: true })
    .setInputFiles({
      name: "new-abaya.webp",
      mimeType: "image/webp",
      buffer: await readFile("public/images/home/hero-poster.webp"),
    });
  await expect(
    page.getByText("Photograph uploaded and added", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save & show in store", exact: true })
    .click();
  await expect(
    page.getByText("Product saved. It is visible", { exact: false }),
  ).toBeVisible();
  await expect(shop.locator(".catalog-card")).toHaveCount(1, {
    timeout: 15000,
  });
  await expect(shop.locator(".catalog-card")).toContainText(
    "New arrival silk abaya",
  );
  await expect(shop.locator(".catalog-card")).toContainText("£85.99");
  await expect(
    shop.getByRole("searchbox", { name: "Search the collection" }),
  ).toHaveValue("New arrival");
  await shop
    .getByRole("link", {
      name: "View piece: New arrival silk abaya",
      exact: true,
    })
    .click();
  await expect(
    shop.getByRole("heading", { level: 1, name: "New arrival silk abaya" }),
  ).toBeVisible();
  await expect(
    shop.getByRole("button", { name: "Add to bag", exact: true }),
  ).toBeVisible();
  await visitor.close();
});

test("published copy refreshes a separate visitor but saved drafts stay private", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/");
  await signIn(page);
  await page.goto("/admin/content");
  await page
    .getByRole("searchbox", { name: "Search website text" })
    .fill("Made to");
  await page
    .getByRole("textbox", { name: "Replacement for Made to", exact: true })
    .fill("Created to");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: false })).toBeVisible();
  await expect(shop.locator("#film-title")).toHaveText("Made to Be Seen.");
  await page
    .getByRole("button", { name: "Save & update store", exact: true })
    .click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  await expect(shop.locator("#film-title")).toHaveText("Created to Be Seen.", {
    timeout: 15000,
  });
  await visitor.close();
});

test("store sync returns only a public revision and supports unchanged responses", async ({
  request,
}) => {
  const state = await request.get("/api/storefront/sync");
  expect(state.status()).toBe(200);
  expect(Object.keys(await state.json())).toEqual(["revision"]);
  const unchanged = await request.get("/api/storefront/sync", {
    headers: { "If-None-Match": state.headers().etag },
  });
  expect(unchanged.status()).toBe(304);
  expect(await unchanged.body()).toHaveLength(0);
});

test("homepage choices, colours and hover effects apply to an open visitor session", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/");
  await signIn(page);
  await page.goto("/admin/appearance");
  await page.getByLabel("ink", { exact: true }).fill("#24251f");
  await page
    .getByRole("combobox", { name: "Button & link hover", exact: true })
    .selectOption("magnetic");
  await page
    .getByRole("button", { name: "Hide homepage edit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save & update store", exact: true })
    .click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  await expect(shop.locator(".collection-section")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect
    .poll(() =>
      shop
        .locator(".storefront-shell")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--foreground").trim(),
        ),
    )
    .toBe("#24251f");
  const button = shop.locator(".film-hero__shop");
  const bounds = await button.boundingBox();
  await shop.mouse.move(
    bounds!.x + bounds!.width * 0.85,
    bounds!.y + bounds!.height / 2,
  );
  await expect
    .poll(() =>
      button.evaluate((el) => {
        const t = getComputedStyle(el).transform;
        return t === "none" ? 0 : new DOMMatrix(t).m41;
      }),
    )
    .toBeGreaterThan(1);
  await page
    .getByRole("checkbox", { name: "Layla Burgundy Abaya", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save & update store", exact: true })
    .click();
  await expect(shop.locator(".collection-card")).toHaveCount(1, {
    timeout: 15000,
  });
  await expect(shop.locator(".collection-card")).toContainText(
    "Layla Burgundy Abaya",
  );
  await visitor.close();
});

test("published price changes refresh an open saved bag without a manual reload", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/collection/design-01");
  await shop.getByRole("button", { name: "54", exact: true }).click();
  await shop.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(shop.getByRole("dialog", { name: /^Your bag/ })).toBeVisible();
  await shop.goto("/bag");
  await expect(shop.locator("main .bag-subtotal strong")).toHaveText("£75.00");
  await signIn(page);
  await page.goto("/admin/products");
  await page
    .locator(".admin-product-row")
    .first()
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Price (£)", { exact: true }).fill("88.49");
  await page
    .getByRole("button", { name: "Save & show in store", exact: true })
    .click();
  await expect(
    page.getByText("Product saved. It is visible", { exact: false }),
  ).toBeVisible();
  await expect(shop.locator("main .bag-subtotal strong")).toHaveText("£88.49", {
    timeout: 15000,
  });
  await visitor.close();
});

test("bulk show and hide update an open collection and rows offer visibility and public view without editing", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/collection");
  await expect(shop.locator(".catalog-card")).toHaveCount(1);
  await signIn(page);
  await page.goto("/admin/products");
  const selectAll = page.getByRole("checkbox", {
    name: "Select all matching products",
    exact: true,
  });
  await page.getByRole("searchbox", { name: "Search products" }).fill("Zahra");
  await selectAll.check();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Search products" }).fill("");
  await selectAll.check();
  await page
    .getByRole("checkbox", { name: "Select Layla Burgundy Abaya", exact: true })
    .uncheck();
  expect(
    await selectAll.evaluate((el) => (el as HTMLInputElement).indeterminate),
  ).toBe(true);
  await expect(page.getByText("6 selected", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Show in collection", exact: true })
    .click();
  await expect(
    page.getByText("6 products shown in the collection.", { exact: false }),
  ).toBeVisible();
  await expect(shop.locator(".catalog-card")).toHaveCount(7, {
    timeout: 15000,
  });
  await expect(page.getByRole("link", { name: /^View product / })).toHaveCount(
    7,
  );
  await selectAll.check();
  await page
    .getByRole("button", { name: "Hide from collection", exact: true })
    .click();
  await expect(
    page.getByText("7 products hidden", { exact: false }),
  ).toBeVisible();
  await expect(shop.locator(".catalog-card")).toHaveCount(0, {
    timeout: 15000,
  });
  await page
    .getByRole("button", {
      name: "Show Layla Burgundy Abaya in collection",
      exact: true,
    })
    .click();
  await expect(shop.locator(".catalog-card")).toHaveCount(1, {
    timeout: 15000,
  });
  await expect(
    page.getByRole("link", {
      name: "View product Layla Burgundy Abaya",
      exact: true,
    }),
  ).toHaveAttribute("href", "/collection/design-01");
  await page
    .getByRole("button", {
      name: "Hide Layla Burgundy Abaya from collection",
      exact: true,
    })
    .click();
  await expect(shop.locator(".catalog-card")).toHaveCount(0, {
    timeout: 15000,
  });
  await visitor.close();
});

test("incomplete bulk visibility shows an actionable error and keeps the selection without partly publishing", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/products");
  await page
    .locator(".admin-product-row")
    .first()
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("Price (£)", { exact: true }).fill("");
  await page
    .getByRole("combobox", { name: "Store visibility", exact: true })
    .selectOption("draft");
  await page
    .getByRole("button", { name: "Save hidden draft", exact: true })
    .click();
  await expect(
    page.getByText("Product saved as a hidden draft", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "Select all matching products",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Show in collection", exact: true })
    .click();
  await expect(
    page.getByText("Cannot show selected products.", { exact: false }),
  ).toContainText("design-01");
  await expect(page.getByText("7 selected", { exact: true })).toBeVisible();
  const snapshot = await (await page.request.get("/api/admin")).json();
  expect(
    snapshot.products.every((p: { status: string }) => p.status === "draft"),
  ).toBe(true);
});

test("owner can delete a product and an open visitor collection updates", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/collection");
  await expect(shop.locator(".catalog-card")).toHaveCount(1);
  await signIn(page);
  await page.goto("/admin/products");
  await expect(
    page.getByRole("button", { name: "Add product", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Delete product Layla Burgundy Abaya",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Product deleted.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".admin-product-row")).toHaveCount(6);
  await expect(shop.locator(".catalog-card")).toHaveCount(0, {
    timeout: 15000,
  });
  expect((await visitor.request.get("/collection/design-01")).status()).toBe(
    404,
  );
  await visitor.close();
});

test("system videos and images upload in the shared picker and can be reused on different pages", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(90000);
  await signIn(page);
  await page.goto("/admin/hero");
  await page.getByRole("button", { name: /^Browse videos/ }).click();
  let picker = page.getByRole("dialog", {
    name: "Choose an MP4 video",
    exact: true,
  });
  await picker
    .getByLabel("Upload from computer", { exact: true })
    .setInputFiles({
      name: "client-film.mp4",
      mimeType: "video/mp4",
      buffer: await readFile("public/videos/home/hero.mp4"),
    });
  await expect(picker).not.toBeVisible();
  const film = await page.locator(".admin-video-preview").getAttribute("src");
  expect(film).toMatch(/^\/api\/media\//);
  expect((await request.get(film!)).status()).toBe(404);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: false })).toBeVisible();
  await page.goto("/admin/media");
  await page
    .locator(".admin-asset-card")
    .filter({ hasText: "client-film.mp4" })
    .getByRole("button", { name: "Use on a page", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Page for section 1", exact: true })
    .selectOption("/our-story");
  await page
    .getByLabel("Caption for section 1 (optional)", { exact: true })
    .fill("A film from SEEN.");
  await page
    .getByRole("button", { name: "Add image or video section", exact: true })
    .click();
  picker = page.getByRole("dialog", {
    name: "Choose an image or video",
    exact: true,
  });
  await picker
    .getByRole("button", { name: "Use client-film.mp4", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Page for section 2", exact: true })
    .selectOption("/collection/design-01");
  await page
    .getByRole("button", { name: "Add image or video section", exact: true })
    .click();
  picker = page.getByRole("dialog", {
    name: "Choose an image or video",
    exact: true,
  });
  await picker
    .getByLabel("Upload from computer", { exact: true })
    .setInputFiles({
      name: "client-campaign.webp",
      mimeType: "image/webp",
      buffer: await readFile("public/images/home/hero-poster.webp"),
    });
  await expect(picker).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Page for section 3", exact: true })
    .selectOption("/contact");
  await page
    .getByLabel("Description for section 3", { exact: true })
    .fill("SEEN campaign portrait");
  await page
    .getByRole("button", { name: "Save & update store", exact: true })
    .click();
  await expect(
    page.getByText("Published. Your changes", { exact: false }),
  ).toBeVisible();
  const visitor = await browser.newContext();
  const shop = await visitor.newPage();
  await shop.goto("/our-story");
  await expect(shop.locator("[data-media-section] video")).toHaveAttribute(
    "src",
    film!,
  );
  await expect(shop.locator("[data-media-section] figcaption")).toHaveText(
    "A film from SEEN.",
  );
  await shop.goto("/collection/design-01");
  await expect(shop.locator("[data-media-section] video")).toHaveAttribute(
    "src",
    film!,
  );
  await shop.goto("/contact");
  await expect(
    shop.getByRole("img", { name: "SEEN campaign portrait", exact: true }),
  ).toBeVisible();
  expect((await request.get(film!)).status()).toBe(200);
  await visitor.close();
});

for (const width of [390, 1440])
  test(`media picker is accessible and restores keyboard focus at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto("/admin/media");
    const trigger = page.getByRole("button", {
      name: "Add image or video section",
      exact: true,
    });
    await trigger.click();
    const picker = page.getByRole("dialog", {
      name: "Choose an image or video",
      exact: true,
    });
    await expect(picker).toBeVisible();
    await picker.evaluate((el) => (el.scrollTop = 0));
    expect(await picker.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      false,
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/media-picker-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press("Escape");
    await expect(picker).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
