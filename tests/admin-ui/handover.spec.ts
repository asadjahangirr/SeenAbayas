import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page, password = "Test-password-only-123") {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}
test.beforeEach(async ({ request }) => { await request.get("http://127.0.0.1:3106/__test/reset"); });

test("category names generate slugs, edits persist and unused categories can be deleted", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/categories");
  await page.getByText("Add category", { exact: true }).click();
  const add = page.locator(".admin-entity-form").filter({ has: page.locator("summary", { hasText: "Add category" }) });
  await add.getByLabel("Name", { exact: true }).fill("Evening occasion");
  await expect(add.getByLabel("Slug", { exact: true })).toHaveValue("evening-occasion");
  await add.getByLabel("Description", { exact: true }).fill("QA category fixture.");
  await add.getByRole("button", { name: "Save category", exact: true }).click();
  const record = page.locator(".admin-record").filter({ hasText: "Evening occasion" });
  await record.getByText("Edit category", { exact: true }).click();
  await record.getByLabel("Name", { exact: true }).fill("Evening edit");
  await expect(record.getByLabel("Slug", { exact: true })).toHaveValue("evening-edit");
  await record.getByLabel("Display order").fill("3");
  await record.getByRole("button", { name: "Save category", exact: true }).click();
  await page.reload();
  const saved = page.locator(".admin-record").filter({ hasText: "Evening edit" });
  await saved.getByText("Edit category", { exact: true }).click();
  await expect(saved.getByLabel("Display order")).toHaveValue("3");
  page.once("dialog", dialog => dialog.accept());
  await saved.getByRole("button", { name: "Delete Evening edit", exact: true }).click();
  await expect(saved).toHaveCount(0);
});

test("coupon fixed amounts, expiry and usage settings survive editing and deletion", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/coupons");
  await page.getByText("Add coupon", { exact: true }).click();
  const add = page.locator(".admin-entity-form").filter({ has: page.locator("summary", { hasText: "Add coupon" }) });
  await add.getByLabel("Coupon code").fill("qaedit");
  await expect(add.getByLabel("Coupon code")).toHaveValue("QAEDIT");
  await add.getByLabel("Discount type").selectOption("fixed");
  await add.getByLabel("Discount (£)", { exact: true }).fill("5.25");
  await add.getByLabel("Minimum subtotal (£)").fill("40.00");
  await add.getByLabel("Expiry (optional)").fill("2027-12-01T12:30");
  await add.getByLabel("Usage limit (optional)").fill("12");
  await add.getByRole("button", { name: "Save coupon", exact: true }).click();
  await page.reload();
  const record = page.locator(".admin-record").filter({ hasText: "QAEDIT" });
  await record.getByText("Edit coupon", { exact: true }).click();
  await expect(record.getByLabel("Discount (£)", { exact: true })).toHaveValue("5.25");
  await expect(record.getByLabel("Minimum subtotal (£)")).toHaveValue("40.00");
  await expect(record.getByLabel("Usage limit (optional)")).toHaveValue("12");
  await record.getByLabel("Active", { exact: true }).uncheck();
  await record.getByRole("button", { name: "Save coupon", exact: true }).click();
  await page.reload();
  await record.getByText("Edit coupon", { exact: true }).click();
  await expect(record.getByLabel("Active", { exact: true })).not.toBeChecked();
  page.once("dialog", dialog => dialog.accept());
  await record.getByRole("button", { name: "Delete QAEDIT", exact: true }).click();
  await expect(record).toHaveCount(0);
});

test("expense pounds, date and notes persist through edits and delete correctly", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/finance");
  await page.getByText("Add expense", { exact: true }).click();
  const add = page.locator(".admin-entity-form").filter({ has: page.locator("summary", { hasText: "Add expense" }) });
  await add.getByLabel("Expense title").fill("QA packaging");
  await add.getByLabel("Amount (£)").fill("12.50");
  await add.getByLabel("Date", { exact: true }).fill("2026-10-22");
  await add.getByLabel("Note", { exact: true }).fill("Isolated handover fixture.");
  await add.getByRole("button", { name: "Save expense", exact: true }).click();
  const record = page.locator(".admin-record").filter({ hasText: "QA packaging" });
  await record.getByText("Edit expense", { exact: true }).click();
  await record.getByLabel("Amount (£)").fill("16.80");
  await record.getByRole("button", { name: "Save expense", exact: true }).click();
  await page.reload();
  await expect(record.locator(".admin-list-row")).toContainText("£16.80");
  await record.getByText("Edit expense", { exact: true }).click();
  await expect(record.getByRole("textbox", { name: "Note", exact: true })).toHaveValue("Isolated handover fixture.");
  page.once("dialog", dialog => dialog.accept());
  await record.getByRole("button", { name: "Delete QA packaging", exact: true }).click();
  await expect(record).toHaveCount(0);
});

test("history restoration stays private until published and original-copy reset also stays in draft", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/admin/content");
  await page.getByRole("searchbox", { name: "Search website text" }).fill("Made to");
  const field = page.getByRole("textbox", { name: "Replacement for Made to", exact: true });
  for (const copy of ["Created to", "Crafted to"]) {
    await field.fill(copy);
    await page.getByRole("button", { name: "Save & update store", exact: true }).click();
    await expect(page.getByText("Published. Your changes", { exact: false })).toBeVisible();
  }
  await page.goto("/admin/history");
  const revisions = page.locator("section").filter({ has: page.getByRole("heading", { name: "Published revisions", exact: true }) });
  await revisions.locator(".admin-list-row").filter({ hasText: /^Revision 1/ }).getByRole("button", { name: "Restore to draft", exact: true }).click();
  await expect(page.getByText("Revision restored to draft.", { exact: true })).toBeVisible();
  expect(await (await page.request.get("/")).text()).toContain("Crafted to");
  await page.goto("/admin/preview");
  await expect(page.locator("#film-title")).toHaveText("Created to Be Seen.");
  await page.goto("/admin/content");
  await page.getByRole("button", { name: "Save & update store", exact: true }).click();
  await expect(page.getByText("Published. Your changes", { exact: false })).toBeVisible();
  expect(await (await page.request.get("/")).text()).toContain("Created to");
  await page.getByRole("searchbox", { name: "Search website text" }).fill("Made to");
  await page.getByRole("button", { name: "Restore original: Made to", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: false })).toBeVisible();
  expect(await (await page.request.get("/")).text()).toContain("Created to");
  await page.goto("/admin/preview");
  await expect(page.locator("#film-title")).toHaveText("Made to Be Seen.");
});

test("password change rejects wrong credentials and mismatched confirmation before changing and signing out", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.goto("/admin/security");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Change password & sign out all sessions", exact: true }) });
  const nextPassword = "QA-updated-password-only-456";
  await form.getByLabel("Current password", { exact: true }).fill("wrong-fixture-password");
  await form.getByLabel("New password (at least 14 characters)").fill(nextPassword);
  await form.getByLabel("Confirm new password").fill("different-fixture-password");
  await form.getByLabel("Authenticator code").fill("123456");
  await form.getByRole("button", { name: "Change password & sign out all sessions", exact: true }).click();
  await expect(page.getByText("The new passwords do not match.", { exact: true })).toBeVisible();
  await form.getByLabel("Confirm new password").fill(nextPassword);
  await form.getByRole("button", { name: "Change password & sign out all sessions", exact: true }).click();
  await expect(page.getByText("Current password was not accepted.", { exact: true })).toBeVisible();
  await form.getByLabel("Current password", { exact: true }).fill("Test-password-only-123");
  await form.getByRole("button", { name: "Change password & sign out all sessions", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get("/api/admin")).status()).toBe(401);
  await signIn(page, nextPassword);
});
