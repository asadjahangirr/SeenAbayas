import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [320, 768, 1440]) test(`empty shopping bag is responsive and accessible at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open shopping bag, 0 items", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /^Your bag/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /Your next favourite/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close shopping bag" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.goto("/bag");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your shopping bag.00");
  await expect(page.locator(".bag-page .bag-empty")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  if (width === 1440) await page.screenshot({ path: "test-results/bag-desktop-empty.png", fullPage: true });
  if (width === 320) await page.screenshot({ path: "test-results/bag-mobile-empty.png", fullPage: true });
});

test("preview photographs cannot be added using a forged bag request", async ({ request }) => {
  const response = await request.post("/api/bag", { data: { lines: [{ variantId: "20000000-0000-4000-8000-000000000001", quantity: 1 }] } });
  expect(response.status()).toBe(409);
  expect(await response.text()).not.toMatch(/secret|on_hand|publishable/);
});
