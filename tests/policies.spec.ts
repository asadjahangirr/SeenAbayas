import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/shipping-delivery", "/returns-exchanges", "/privacy-policy", "/terms-conditions", "/cookie-policy"];
for (const width of [320, 768, 1440]) for (const route of routes) {
  test(`policy ${route} is responsive and accessible at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Policy preview notice" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(errors).toEqual([]);
    if (["/shipping-delivery", "/returns-exchanges", "/cookie-policy"].includes(route) && width !== 768) {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(document.querySelector("main")!.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
      });
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
    }
  });
}

test("returns preserves the supplied policy and offers an optional downloadable cancellation form", async ({ page, request }) => {
  await page.goto("/returns-exchanges");
  const source = readFileSync("docs/MASTER_PLAN.md", "utf8").split("OFFICIAL POLICY:")[1].split("RETURNS PAGE DESIGN:")[0];
  const headings = new Set(["RETURNS & EXCHANGES POLICY", "Exchanges", "Refunds & Cancellations", "Faulty or Incorrect Items", "How to Request an Exchange or Return", "Important Information"]);
  for (const paragraph of source.split(/\r?\n\s*\r?\n/).map((text) => text.trim()).filter((text) => text && !headings.has(text))) await expect(page.getByText(paragraph, { exact: true })).toHaveCount(1);
  await expect(page.locator("#cancellation-form")).toContainText("You do not have to request an exchange first or give a reason");
  const form = await request.get("/returns-exchanges/cancellation-form");
  expect(form.status()).toBe(200);
  expect(form.headers()["content-type"]).toContain("text/plain");
  expect(form.headers()["content-disposition"]).toContain("attachment");
  expect(form.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(await form.text()).toContain("MODEL CANCELLATION FORM");
  await page.locator(".cancellation-disclosure summary").click();
  await expect(page.locator(".cancellation-template")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("shipping shows unconfirmed fees honestly and links to real Royal Mail tracking", async ({ page }) => {
  await page.goto("/shipping-delivery");
  await expect(page.locator("#standard-delivery")).toContainText("To be confirmed");
  await expect(page.locator("#express-delivery")).toContainText("To be confirmed");
  await expect(page.locator("#complimentary-delivery")).toContainText("An order of exactly £80 qualifies");
  await expect(page.getByRole("link", { name: "Track your Royal Mail item" })).toHaveAttribute("href", "https://www.royalmail.com/track-your-item");
  await page.setViewportSize({ width: 390, height: 844 });
  const jump = page.locator(".policy-mobile-contents");
  await jump.locator("summary").focus();
  await page.keyboard.press("Enter");
  await jump.getByRole("link", { name: "Order tracking", exact: true }).click();
  await expect(page).toHaveURL(/#tracking$/);
});

test("footer and mobile navigation expose the new delivery and policy pages", async ({ page, request }) => {
  await page.goto("/");
  const footerPaths = await page.locator("footer a[href^='/']").evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  for (const path of routes) {
    expect(footerPaths).toContain(path);
    expect((await request.get(path)).status()).toBe(200);
  }
  await expect(page.getByRole("link", { name: "Complimentary UK delivery on orders of £80 or more", exact: true })).toHaveAttribute("href", "/shipping-delivery");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Explore SEEN" });
  await expect(dialog.getByRole("link", { name: "Shipping & Delivery", exact: true })).toBeVisible();
  await dialog.getByRole("link", { name: "Returns & Exchanges", exact: true }).click();
  await expect(page).toHaveURL(/\/returns-exchanges$/);
  await expect(dialog).not.toBeVisible();
});

test("clearing saved bag removes both bag entries, updates tabs and preserves unrelated storage", async ({ page, context }) => {
  await page.goto("/cookie-policy");
  await page.evaluate(() => {
    const saved = JSON.stringify({ version: 1, lines: [{ variantId: "70000000-0000-4000-8000-000001000001", quantity: 2 }] });
    localStorage.setItem("seen.bag.v1", saved);
    localStorage.setItem("seen.bag.v1.development", saved);
    localStorage.setItem("unrelated.test.preference", "keep");
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Open shopping bag, 2 items", exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/cookie-policy");
  await expect(other.getByRole("button", { name: "Open shopping bag, 2 items", exact: true })).toBeVisible();
  const clear = page.getByRole("button", { name: "Clear saved bag", exact: true });
  await expect(clear).toBeEnabled();
  await clear.click();
  await expect(page.getByText("Your saved bag has been cleared on this browser.", { exact: true })).toBeVisible();
  for (const tab of [page, other]) await expect(tab.getByRole("button", { name: "Open shopping bag, 0 items", exact: true })).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem("seen.bag.v1"), localStorage.getItem("seen.bag.v1.development"), localStorage.getItem("unrelated.test.preference")])).toEqual([null, null, "keep"]);
  await other.close();
});

test("blocked browser storage produces honest feedback instead of a false clear confirmation", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.removeItem = () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await page.goto("/cookie-policy");
  await page.getByRole("button", { name: "Clear saved bag", exact: true }).click();
  await expect(page.getByText("Your bag is empty, but browser storage could not be cleared.", { exact: false })).toBeVisible();
  await expect(page.getByText("Your saved bag has been cleared on this browser.", { exact: true })).not.toBeVisible();
});
