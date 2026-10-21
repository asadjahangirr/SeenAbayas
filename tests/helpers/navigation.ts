import { expect, type Page } from "@playwright/test";

/** Follow the approved mobile flow: scroll the film until its logo docks. */
export async function revealHomeNavigation(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 1024) return;
  const hero = page.locator(".film-hero");
  if (!(await hero.count())) return;
  await expect(hero).toHaveAttribute("data-motion-ready", "true");
  await page.evaluate(() => {
    const hero = document.querySelector(".film-hero")!;
    window.scrollTo({ top: hero.getBoundingClientRect().bottom + window.scrollY, behavior: "instant" });
  });
  await expect(page.locator(".header-inner")).toHaveCSS("visibility", "visible");
  await expect(page.locator(".header-inner")).toHaveCSS("opacity", "1");
}
