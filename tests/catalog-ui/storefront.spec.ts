import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";

async function setState(request: APIRequestContext, state: string) {
  const response = await request.post("http://127.0.0.1:3101/__test/state", { headers: { apikey: "sb_publishable_TEST_ONLY" }, data: { state } });
  expect(response.ok()).toBe(true);
}
test.beforeEach(async ({ request }) => { await setState(request, "ready"); });

test("configured catalog displays approved names, GBP prices and real size availability", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => { if (request.url().startsWith("http://127.0.0.1:3101")) external.push(request.url()); });
  await page.goto("/collection");
  await expect(page.locator(".catalog-card")).toHaveCount(2);
  await expect(page.locator(".catalog-card__price")).toHaveText(["£123.45", "£98.76"]);
  await page.getByRole("link", { name: "View piece: TEST ONLY Burgundy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("TEST ONLY Burgundy");
  await expect(page.locator(".piece-description")).toHaveText("TEST ONLY confirmed description.");
  await expect(page.locator(".piece-price")).toHaveText("£123.45");
  await expect(page.locator(".piece-sizes li")).toHaveText(["TEST SAvailable", "TEST MOut of stock"]);
  await expect(page.locator(".piece-related .catalog-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Add to (bag|cart)/i })).toHaveCount(0);
  expect(external).toEqual([]);
});

test("an empty published catalog stays empty and unpublished product paths return 404", async ({ page, request }) => {
  await setState(request, "empty");
  await page.goto("/collection");
  await expect(page.locator(".catalog-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "The collection is being prepared." })).toBeVisible();
  expect((await request.get("/collection/design-01")).status()).toBe(404);
  await page.goto("/");
  await expect(page.locator(".collection-card")).toHaveCount(0);
});

test("backend failures show a safe retry state without preview merchandise or database diagnostics", async ({ page, request }) => {
  await setState(request, "failure");
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: "We couldn't load the collection." })).toBeVisible();
  await expect(page.locator(".catalog-card")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("DO NOT DISCLOSE");
  await setState(request, "ready");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(2);
});

test("unexpected private fields are rejected and published reads are not cached across requests", async ({ page, request }) => {
  await setState(request, "invalid");
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: "We couldn't load the collection." })).toBeVisible();
  await expect(page.locator(".catalog-card")).toHaveCount(0);
  await setState(request, "ready");
  const ready = await request.get("/collection");
  expect(await ready.text()).toContain("TEST ONLY Burgundy");
  await setState(request, "empty");
  const empty = await request.get("/collection");
  expect(await empty.text()).not.toContain("TEST ONLY Burgundy");
  expect(empty.headers()["cache-control"]).toContain("no-store");
});

test("confirmed prices and sizes remain accessible on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/collection/design-01");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
});
