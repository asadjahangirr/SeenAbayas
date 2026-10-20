import { test, expect } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`new Brown and Olive galleries load every supplied view at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const [id, name, views] of [["design-08", "Brown", 4], ["design-09", "Olive", 3]] as const) {
      await page.goto(`/collection/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
      for (let index = 0; index < views; index++) {
        const photo = page.locator(".piece-photo > img");
        await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
        await expect(page.locator(".piece-gallery__meta")).toContainText(`${index+1} / ${views}`);
        if (index===0) {
          await photo.scrollIntoViewIfNeeded();
          await page.screenshot({ path: testInfo.outputPath(`${id}-${width}.png`), fullPage: false });
        }
        await page.getByRole("button", { name: "Next product photograph", exact: true }).click();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}

test("confirmed colours and new designs remain searchable by partial names", async ({ page }) => {
  await page.goto("/collection");
  const search=page.getByRole("searchbox", { name:"Search the collection" });
  for (const [query,name] of [["oli","Olive"],["brow","Brown"],["teal","Teal"],["tie dye","Tie dye blue"],["cream","Cream"]]) {
    await search.fill(query);
    await expect(page.locator(".catalog-card__name")).toHaveText([name]);
  }
  await page.getByRole("button", { name:"Clear search",exact:true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(9);
});
