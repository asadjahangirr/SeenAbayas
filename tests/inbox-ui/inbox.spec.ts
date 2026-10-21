import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const origin = "http://127.0.0.1:3107";
const message = "Please confirm the sleeve length for the Burgundy abaya. QA inbox-only fixture.";
async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Test-password-only-123");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}
test.beforeEach(async ({ request }) => { await request.get("http://127.0.0.1:3106/__test/reset"); });

for (const width of [393, 1440]) test(`customer message reaches the protected admin inbox without Turnstile at ${width}px`, async ({ page }) => {
  // Form, accessibility scan, MFA login and the complete inbox lifecycle share
  // this journey; allow the same headroom as other multi-page admin checks.
  test.setTimeout(60_000);
  await page.setViewportSize({ width, height: 900 });
  const external: string[] = [];
  page.on("request", request => { if (/cloudflare|resend/.test(request.url())) external.push(request.url()); });
  await page.goto("/contact");
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
  await expect(page.locator('script[src*="turnstile"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Inbox journey fixture");
  await page.getByLabel("Email", { exact: true }).fill("inbox-journey@example.test");
  await page.getByLabel("Phone number", { exact: true }).fill("07700900123");
  await page.getByLabel("Message", { exact: true }).fill(message);
  const posted = page.waitForResponse(response => response.url().endsWith("/api/contact") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  expect((await posted).status()).toBe(200);
  await expect(page.locator(".contact-receipt")).toBeVisible();
  await expect(page.locator(".contact-receipt")).toBeFocused();
  expect(external).toEqual([]);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await signIn(page);
  await page.goto("/admin/inbox");
  const summary = page.locator(".admin-record summary").filter({ hasText: "Inbox journey fixture" });
  await expect(summary).toContainText("Unread");
  await summary.click();
  const record = page.locator(".admin-record").filter({ hasText: "Inbox journey fixture" });
  await expect(record.locator(".admin-message-body")).toHaveText(message);
  await expect(record.getByRole("link", { name: "Reply by email" })).toHaveAttribute("href", "mailto:inbox-journey%40example.test");
  await record.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(record.getByRole("button", { name: "Mark unread", exact: true })).toBeVisible();
  await record.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(summary).toHaveCount(0);
  await page.getByLabel("Filter messages").selectOption("archived");
  await summary.click();
  await record.getByRole("button", { name: "Unarchive", exact: true }).click();
  await expect(summary).toHaveCount(0);
  await page.getByLabel("Filter messages").selectOption("active");
  await summary.click();
  page.once("dialog", dialog => dialog.accept());
  await record.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(summary).toHaveCount(0);
});

test("inbox endpoint deduplicates retries, rejects spam/cross-origin requests and enforces shared sender limits", async ({ request }) => {
  const payload = { name: "Inbox API fixture", email: "inbox-api@example.test", phone: "07700900123", message, website: "", verificationToken: "", submittedAt: new Date().toISOString(), requestId: crypto.randomUUID() };
  const post = (body = payload, selectedOrigin = origin) => request.post("/api/contact", { headers: { Origin: selectedOrigin }, data: body });
  for (let retry = 0; retry < 5; retry++) expect((await post()).status()).toBe(200);
  expect((await post({ ...payload, message: message + " changed" })).status()).toBe(409);
  expect((await post({ ...payload, website: "spam.invalid" })).status()).toBe(400);
  expect((await post(payload, "https://foreign.example.test")).status()).toBe(403);
  for (let i = 0; i < 2; i++) expect((await post({ ...payload, requestId: crypto.randomUUID() })).status()).toBe(200);
  const limited = await post({ ...payload, requestId: crypto.randomUUID() });
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBe("900");
  expect(await limited.text()).not.toMatch(/sb_secret_|fingerprint|network_hash/);
});
