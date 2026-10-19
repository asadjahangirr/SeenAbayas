import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [320, 768, 1440]) {
  for (const path of ["/our-story", "/contact", "/size-guide", "/faqs"]) {
    test(`content page ${path} is responsive and accessible at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      for (const image of await page.locator("main img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      }
      // Image loading may scroll a link partly under the sticky header. Scan the
      // initial viewport consistently instead of auditing that incidental offset.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(scan.violations).toEqual([]);
      expect(errors).toEqual([]);
      if (width !== 768) {
        // Reset the viewport after lazy-image checks so fixed/sticky elements
        // are captured at the top of a full-page screenshot.
        await page.evaluate(async () => {
          window.scrollTo({ top: 0, behavior: "instant" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          await Promise.all(document.querySelector("main")!.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
        });
        await page.screenshot({ path: testInfo.outputPath(`${path.slice(1)}-${width}.png`), fullPage: true });
      }
    });
  }
}

test("story preserves every official paragraph and links to the collection", async ({ page }) => {
  await page.goto("/our-story");
  for (const paragraph of [
    "At SEEN ABAYAS, we believe modesty and style should exist effortlessly together.",
    "Founded by sisters with a shared passion for modest fashion, SEEN was born from a vision to create a brand that celebrates timeless elegance, individuality and confidence.",
    "Created with the modern woman in mind, our collections bring together refined silhouettes, beautiful details and contemporary designs, offering modestwear that feels as special as the woman wearing it.",
    "From everyday sophistication to statement evening pieces, each design is thoughtfully selected to complement every occasion, allowing you to express your personal style without compromising on modesty.",
    "We believe true elegance doesn't demand attention. It leaves an impression.",
    "SEEN ABAYAS — Elegance that speaks for itself.",
  ]) await expect(page.getByText(paragraph, { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Shop the collection", exact: true })).toHaveAttribute("href", "/collection");
});

test("size reference converts inches accurately and product dialog restores focus", async ({ page }) => {
  await page.goto("/collection/design-01");
  const trigger = page.getByRole("button", { name: "Size guide", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Size Guide", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close size guide" })).toBeFocused();
  await dialog.getByRole("button", { name: "Centimetres", exact: true }).click();
  for (const value of ["132.08", "137.16", "142.24", "147.32", "152.40"]) await expect(dialog.getByRole("cell", { name: value, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "View the full size guide" }).click();
  await expect(page).toHaveURL(/\/size-guide$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("FAQ accordions work with a keyboard and expose honest preview answers", async ({ page }) => {
  await page.goto("/faqs");
  const details = page.locator("details").filter({ hasText: "Do you offer free delivery?" });
  await details.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(details.locator("div")).toContainText("exactly £80 does not qualify");
  await page.keyboard.press("Space");
  await expect(details).not.toHaveAttribute("open", "");
  await page.getByRole("link", { name: "Sizing & fit", exact: true }).click();
  await expect(page).toHaveURL(/#sizing$/);
});

test("unconfigured contact form has all required fields and cannot claim delivery", async ({ page, request }) => {
  await page.goto("/contact");
  for (const name of ["Name", "Email", "Phone number", "Message"]) await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  await expect(page.getByText("Our contact form is currently unavailable.", { exact: false })).toBeVisible();
  expect((await request.post("/api/contact", { headers: { origin: "http://127.0.0.1:3100" }, data: { name: "Amina Khan", email: "amina@example.invalid", phone: "+44 7700 900123", message: "Please check these measurements.", website: "", verificationToken: "test-only", requestId: crypto.randomUUID(), submittedAt: new Date().toISOString() } })).status()).toBe(503);
  await expect(page.getByText("Your message has been received.", { exact: false })).not.toBeVisible();
});

test("desktop and mobile navigation open dedicated pages and mobile help links", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Our Story", exact: true }).click();
  await expect(page).toHaveURL(/\/our-story$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Our Story", exact: true })).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Explore SEEN" });
  await expect(dialog.getByRole("link", { name: "Size Guide", exact: true })).toBeVisible();
  await dialog.getByRole("link", { name: "FAQs", exact: true }).click();
  await expect(page).toHaveURL(/\/faqs$/);
  await expect(dialog).not.toBeVisible();
});
