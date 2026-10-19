import { expect, test } from "@playwright/test";

test("the permanent film homepage has no photo variant or preview flag", async ({ page }) => {
  for (const url of ["/", "/?hero=photography", "/?hero=film"]) {
    await page.goto(url);
    await expect(page.locator(".film-hero")).toBeVisible();
    await expect(page.locator(".hero-lookbook, .hero-visuals")).toHaveCount(0);
    const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
    expect(canonical.pathname).toBe("/");
    expect(canonical.search).toBe("");
    await expect(page).toHaveTitle("SEEN ABAYAS | Made to Be Seen.");
  }
});

test("the bundled homepage media is served with video range support", async ({ request }) => {
  const video = await request.get("/videos/home/hero.mp4", { headers: { Range: "bytes=0-31" } });
  expect(video.status()).toBe(206);
  expect(video.headers()["content-type"]).toContain("video/mp4");
  expect(video.headers()["content-range"]).toMatch(/^bytes 0-31\/[0-9]+$/);
  expect((await video.body()).length).toBe(32);
  const poster = await request.get("/images/home/hero-poster.webp");
  expect(poster.status()).toBe(200);
  expect(poster.headers()["content-type"]).toContain("image/webp");
});
