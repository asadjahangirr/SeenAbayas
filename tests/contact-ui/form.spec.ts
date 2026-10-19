import { expect, test, type Page } from "@playwright/test";

async function installVerificationFixture(page: Page) {
  await page.route("https://challenges.cloudflare.com/**", async (route) => {
    if (route.request().resourceType() === "script") {
      await route.fulfill({ contentType: "application/javascript", body: `(() => {
        let callback;
        window.turnstile = {
          render(element, options) {
            callback = options.callback;
            const iframe = document.createElement('iframe');
            iframe.title = 'Test security check';
            iframe.src = 'https://challenges.cloudflare.com/contact-test-frame';
            element.appendChild(iframe);
            queueMicrotask(() => callback('browser-test-token'));
            return 'test-widget';
          },
          reset() { queueMicrotask(() => callback('browser-retry-token')); },
          remove() {}
        };
      })();` });
    } else await route.fulfill({ contentType: "text/html", body: "<!doctype html><html lang='en'><title>Test verification</title><body>Verification fixture ready</body></html>" });
  });
}

async function fillForm(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Amina Khan");
  await page.getByLabel("Email", { exact: true }).fill("amina@example.invalid");
  await page.getByLabel("Phone number", { exact: true }).fill("+44 7700 900123");
  await page.getByLabel("Message", { exact: true }).fill("Please help me check the sleeve measurements of the charcoal abaya.");
}

test("contact widget works after client navigation under the nonce CSP", async ({ page }) => {
  await installVerificationFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Contact Us", exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.frameLocator('iframe[title="Test security check"]').getByText("Verification fixture ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
});

test("contact validates fields, preserves failed messages, prevents double submits and retries with the same reference", async ({ page }) => {
  await installVerificationFixture(page);
  const submissions: Record<string, string>[] = [];
  await page.route("**/api/contact", async (route) => {
    submissions.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({ status: submissions.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(submissions.length === 1 ? { error: "Please try again in a moment." } : { success: true }) });
  });
  await page.goto("/contact");
  await expect(page.frameLocator('iframe[title="Test security check"]').getByText("Verification fixture ready")).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await fillForm(page);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sending your message…" })).toBeDisabled();
  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator("form").getByRole("alert")).toHaveText("Please try again in a moment.");
  expect(submissions).toHaveLength(1);
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("Please help me check the sleeve measurements of the charcoal abaya.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Thank you for contacting SEEN ABAYAS. Your message has been received.")).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[0].requestId).toBe(submissions[1].requestId);
  expect(submissions[0].submittedAt).toBe(submissions[1].submittedAt);
  await expect(page.locator(".contact-receipt")).toBeFocused();
  await page.getByRole("button", { name: "Send another message" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
});
