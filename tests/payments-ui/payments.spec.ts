import {
  test,
  expect,
  devices,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID, createHmac } from "node:crypto";

const headers = {
  Origin: "http://127.0.0.1:3107",
  "Content-Type": "application/json",
};
const recoveryHeaders = {
  Authorization: "Bearer seen-local-fixture-recovery-token-only-123456",
};
const customer = {
  email: "test-shopper@example.test",
  firstName: "Test",
  lastName: "Shopper",
  phone: "",
  addressLine1: "1 Example Street",
  addressLine2: "",
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB",
};
test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3106/__test/reset");
  await request.get("http://127.0.0.1:3108/__test/reset");
});
async function state(request: APIRequestContext) {
  return (await request.get("http://127.0.0.1:3108/__test/state")).json();
}
async function event(
  request: APIRequestContext,
  data: Record<string, unknown>,
) {
  return (
    await request.post("http://127.0.0.1:3108/__test/event", { data })
  ).json();
}
async function review(page: Page, quantity = 2) {
  await page.goto("/collection/design-01");
  await page.getByRole("button", { name: "54", exact: true }).click();
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  const bag = page.getByRole("dialog", { name: /^Your bag/ });
  await expect(bag).toBeVisible();
  if (quantity === 2) {
    await bag.getByRole("button", { name: "Increase quantity" }).click();
    await expect(bag.locator(".bag-subtotal strong")).toHaveText("£150.00");
  }
  await bag
    .getByRole("button", { name: "Close shopping bag", exact: true })
    .click();
  await page.goto("/checkout");
  await expect(page.locator(".checkout-preview")).toContainText(
    "Test environment",
  );
  for (const [key, value] of Object.entries(customer))
    if (key !== "country") await page.locator(`#checkout-${key}`).fill(value);
  await page
    .getByRole("button", { name: "Review your details", exact: true })
    .click();
  await expect(page.locator(".checkout-review")).toBeVisible();
}
async function open(page: Page) {
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Isolated Stripe test transport</body></html>",
    }),
  );
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/checkout/session") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Continue to test payment", exact: true })
    .click();
  const result = await response;
  if (result.status() !== 200) throw new Error(await result.text());
  await expect(page).toHaveURL(/^https:\/\/checkout.stripe.com\//);
  const fixture = await state(page.request);
  return fixture.sessions.at(-1).metadata.order_id as string;
}

test("signed test success creates a private order, releases stock once and preserves the bag", async ({
  page,
  request,
  browser,
}) => {
  await review(page);
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "seen_checkout_owner",
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  const orderId = await open(page);
  let current = await state(request);
  expect(current.stock[0]).toEqual({ on_hand: 5, reserved: 2 });
  expect(current.sessions).toHaveLength(1);
  const sessionId = current.sessions[0].id;
  expect(
    (
      await event(request, {
        sessionId,
        state: "paid",
        eventId: "evt_duplicate_test",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await event(request, {
        sessionId,
        state: "paid",
        eventId: "evt_duplicate_test",
      })
    ).status,
  ).toBe(200);
  await page.goto(`http://127.0.0.1:3107/order-confirmation?order=${orderId}`);
  await expect(
    page.getByRole("heading", { name: "Test payment complete.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".confirmation-page")).toContainText(
    "no garments will be dispatched",
  );
  expect((await state(request)).stock[0]).toEqual({ on_hand: 5, reserved: 0 });
  const status = await page.request.get(
    `/api/checkout/status?order=${orderId}`,
  );
  const body = await status.json();
  expect(body.order.state).toBe("paid");
  for (const forbidden of [
    "owner_hash",
    "request_hash",
    "checkout_url",
    "session_id",
  ])
    expect(JSON.stringify(body)).not.toContain(forbidden);
  expect(
    await page.evaluate(() => JSON.stringify(Object.entries(localStorage))),
  ).not.toContain(customer.email);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("seen.bag.v1")!).lines[0].quantity,
    ),
  ).toBe(2);
  const stranger = await browser.newContext();
  expect(
    (
      await stranger.request.get(
        `http://127.0.0.1:3107/api/checkout/status?order=${orderId}`,
      )
    ).status(),
  ).toBe(404);
  await stranger.close();
});

test("an interrupted session response recovers the same checkout and reservation", async ({
  page,
  request,
}) => {
  await review(page);
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/checkout/session", async (route) => {
    payload = route.request().postDataJSON();
    const response = await route.fetch();
    if (response.status() !== 200) {
      await route.fulfill({ response });
      return;
    }
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Continue to test payment", exact: true })
    .click();
  await expect(page.locator(".checkout-error")).toBeVisible();
  await page.unroute("**/api/checkout/session");
  await open(page);
  const current = await state(request);
  expect(current.sessions).toHaveLength(1);
  expect(current.customers).toBe(1);
  expect(current.stock[0].reserved).toBe(2);
  expect(
    (
      await page.request.post("http://127.0.0.1:3107/api/checkout/session", {
        headers,
        data: { ...payload, details: { ...customer, firstName: "Changed" } },
      })
    ).status(),
  ).toBe(403);
});

test("only provider confirmation settles; cancellation releases and forged webhooks are rejected", async ({
  page,
  request,
}) => {
  await review(page);
  const order = await open(page);
  const sessionId = (await state(request)).sessions[0].id;
  expect(
    (await event(request, { sessionId, state: "open", badSignature: true }))
      .status,
  ).toBe(400);
  await page.goto(
    `http://127.0.0.1:3107/order-confirmation?order=${order}&cancelled=1&paid=true`,
  );
  await expect(
    page.getByRole("heading", { name: "Your checkout is still open." }),
  ).toBeVisible();
  expect((await state(request)).stock[0].reserved).toBe(2);
  await page
    .getByRole("button", { name: "Cancel this test checkout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your checkout has ended." }),
  ).toBeVisible();
  expect((await state(request)).stock[0]).toEqual({ on_hand: 5, reserved: 0 });
});

test("pending asynchronous payments retain stock and failed payments release it", async ({
  page,
  request,
}) => {
  await review(page);
  const order = await open(page);
  const sessionId = (await state(request)).sessions[0].id;
  expect((await event(request, { sessionId, state: "pending" })).status).toBe(
    200,
  );
  await page.goto(`http://127.0.0.1:3107/order-confirmation?order=${order}`);
  await expect(
    page.getByRole("heading", { name: "Awaiting confirmation." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel this test checkout" }),
  ).toHaveCount(0);
  expect((await state(request)).stock[0].reserved).toBe(2);
  expect((await event(request, { sessionId, state: "failed" })).status).toBe(
    200,
  );
  await page
    .getByRole("button", { name: "Check payment status", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Payment was not completed." }),
  ).toBeVisible();
  expect((await state(request)).stock[0].reserved).toBe(0);
});

test("a mismatched amount cannot settle; browser amounts and stale reviews cannot open payment", async ({
  page,
  request,
}) => {
  await review(page);
  const lines = await page.evaluate(
    () => JSON.parse(localStorage.getItem("seen.bag.v1")!).lines,
  );
  const reviewed = await (
    await page.request.post("/api/checkout/review", {
      headers,
      data: { details: customer, shippingMethod: "standard", lines },
    })
  ).json();
  const payload = {
    details: customer,
    lines,
    shippingMethod: "standard",
    requestId: randomUUID(),
    reviewFingerprint: reviewed.reviewFingerprint,
  };
  expect(
    (
      await page.request.post("/api/checkout/session", {
        headers,
        data: { ...payload, amount: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/checkout/session", {
        headers,
        data: { ...payload, reviewFingerprint: "0".repeat(64) },
      })
    ).status(),
  ).toBe(409);
  expect((await state(request)).sessions).toHaveLength(0);
  await open(page);
  const sessionId = (await state(request)).sessions[0].id;
  expect(
    (
      await event(request, {
        sessionId,
        state: "paid",
        overrides: { amount_total: 1 },
      })
    ).status,
  ).toBe(503);
  expect((await state(request)).stock[0].reserved).toBe(2);
});

test("a paid session without a verified final delivery address is held for review", async ({
  page,
  request,
}) => {
  await review(page);
  const order = await open(page);
  const sessionId = (await state(request)).sessions[0].id;
  expect(
    (
      await event(request, {
        sessionId,
        state: "paid",
        overrides: { collected_information: null },
      })
    ).status,
  ).toBe(200);
  await page.goto(`http://127.0.0.1:3107/order-confirmation?order=${order}`);
  await expect(
    page.getByRole("heading", {
      name: "Your payment needs review.",
      exact: true,
    }),
  ).toBeVisible();
  expect((await state(request)).stock[0].reserved).toBe(2);
});

test("unconfirmed delivery below threshold keeps test payment disabled", async ({
  page,
  request,
}) => {
  await review(page, 1);
  await expect(
    page.getByRole("button", { name: "Delivery rate unavailable", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".checkout-payment")).toContainText(
    "The delivery rate for your selection has not been set",
  );
  await expect(page.locator(".checkout-payment")).not.toContainText(
    "Continue to Stripe",
  );
  expect((await state(request)).sessions).toHaveLength(0);
});

test("scheduled recovery releases expired checkouts without a webhook or customer return and rejects unauthorised callers", async ({page,request}) => {
  await review(page);await open(page);
  for (const method of ["get","post"] as const) {
    expect((await request[method]("/api/payments/reconcile")).status()).toBe(401);
    expect((await request[method]("/api/payments/reconcile",{headers:{Authorization:"Bearer incorrect"}})).status()).toBe(401);
  }
  await request.post("http://127.0.0.1:3108/__test/recovery",{data:{overdue:true}});
  const timestamp=String(Math.floor(Date.now()/1000));
  const signature=createHmac("sha256","seen-local-fixture-recovery-token-only-123456").update(`seen-stock-recovery:v1:${timestamp}:POST:/api/payments/reconcile`).digest("hex");
  const recovered=await request.post("/api/payments/reconcile",{headers:{"x-seen-recovery-timestamp":timestamp,"x-seen-recovery-signature":signature}});
  expect(recovered.status()).toBe(200);
  expect(await recovered.json()).toEqual({checked:1,updated:1,retryRequired:0});
  expect((await state(request)).stock[0]).toEqual({on_hand:5,reserved:0});
  expect((await state(request)).sessions[0].status).toBe("expired");
  const replay=await request.get("/api/payments/reconcile",{headers:recoveryHeaders});
  expect(await replay.json()).toEqual({checked:0,updated:0,retryRequired:0});
});

test("provider outages retain reservations and return a retryable scheduler failure; later verification recovers safely", async ({page,request}) => {
  await review(page);await open(page);
  const id=(await state(request)).sessions[0].id;
  await event(request,{sessionId:id,state:"paid",badSignature:true});
  await request.post("http://127.0.0.1:3108/__test/recovery",{data:{unavailable:true}});
  const failed=await request.post("/api/payments/reconcile",{headers:recoveryHeaders});
  expect(failed.status()).toBe(503);
  expect(await failed.json()).toEqual({checked:1,updated:0,retryRequired:1});
  expect((await state(request)).stock[0].reserved).toBe(2);
  await request.post("http://127.0.0.1:3108/__test/recovery",{data:{unavailable:false,releaseLease:true}});
  const recovered=await request.get("/api/payments/reconcile",{headers:recoveryHeaders});
  expect(await recovered.json()).toEqual({checked:1,updated:1,retryRequired:0});
  expect((await state(request)).stock[0]).toEqual({on_hand:5,reserved:0});
});

test("scheduled recovery keeps completed asynchronous payments reserved and releases a verified orphan", async ({page,request}) => {
  await review(page);await open(page);
  await event(request,{sessionId:(await state(request)).sessions[0].id,state:"pending"});
  await request.post("http://127.0.0.1:3108/__test/recovery",{data:{overdue:true}});
  const pending=await request.post("/api/payments/reconcile",{headers:recoveryHeaders});
  expect(pending.status()).toBe(200);
  expect((await state(request)).stock[0].reserved).toBe(2);
  // A separate interrupted-creation fixture has no provider session to recover.
  await request.post("http://127.0.0.1:3108/__test/recovery",{data:{orphan:true,releaseLease:true}});
  const orphan=await request.post("/api/payments/reconcile",{headers:recoveryHeaders});
  expect(await orphan.json()).toEqual({checked:1,updated:1,retryRequired:0});
  expect((await state(request)).stock[0]).toEqual({on_hand:5,reserved:0});
});

test("two buyers with previously valid reviews cannot both reserve the last units", async ({page,request,browser}) => {
  await review(page);
  const lines=(await page.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines)).map((line:{variantId:string})=>({...line,quantity:3}));
  const buyers=await Promise.all([browser.newContext(),browser.newContext()]);
  try {
    const payloads=await Promise.all(buyers.map(async buyer=>{
      const result=await buyer.request.post("http://127.0.0.1:3107/api/checkout/review",{headers,data:{details:customer,shippingMethod:"standard",lines}});
      const snapshot=await result.json();expect(snapshot.paymentAvailable).toBe(true);
      return {details:customer,shippingMethod:"standard",lines,requestId:randomUUID(),reviewFingerprint:snapshot.reviewFingerprint};
    }));
    const attempts=await Promise.all(buyers.map((buyer,i)=>buyer.request.post("http://127.0.0.1:3107/api/checkout/session",{headers,data:payloads[i]})));
    expect(attempts.map(r=>r.status()).sort()).toEqual([200,409]);
    expect((await state(request)).stock[0]).toEqual({on_hand:5,reserved:3});
    expect((await state(request)).sessions).toHaveLength(1);
  } finally {await Promise.all(buyers.map(buyer=>buyer.close()));}
});

for (const width of [320, 393, 1440])
  test(`test checkout and confirmation remain accessible at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await review(page);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    const order = await open(page);
    await event(request, {
      sessionId: (await state(request)).sessions[0].id,
      state: "paid",
    });
    await page.goto(`http://127.0.0.1:3107/order-confirmation?order=${order}`);
    await expect(
      page.getByRole("heading", { name: "Test payment complete." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/payments-ui/confirmation-${width}.png`,
      fullPage: true,
    });
  });

test("admin distinguishes sandbox payments, prevents dispatch and refreshes provider states", async ({
  page,
  request,
}) => {
  await review(page);
  await open(page);
  const sessionId = (await state(request)).sessions[0].id;
  // The fixture changes Stripe state without a webhook. The owner recovers it.
  await event(request, { sessionId, state: "paid", badSignature: true });
  await page.goto("http://127.0.0.1:3107/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Test-password-only-123");
  await page.getByRole("button", { name: "Continue securely" }).click();
  await page.getByLabel("Authenticator code").fill("123456");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.goto("/admin/orders");
  await page
    .getByRole("button", { name: "Refresh payment statuses", exact: true })
    .click();
  await expect(
    page.getByText("Stripe payment statuses checked.", { exact: false }),
  ).toBeVisible();
  expect((await state(request)).stock[0].reserved).toBe(0);
  const summary = page
    .locator(".admin-record summary")
    .filter({ hasText: "SEEN-T-" });
  await expect(summary).toContainText("Do not dispatch");
  await summary.click();
  const form = page.locator(".admin-record[open]");
  await expect(form.locator("select")).toHaveValue("confirmed");
  await expect(
    form.locator("option").filter({ hasText: /^shipped$/ }),
  ).toHaveJSProperty("disabled", true);
  await page.goto("/admin/finance");
  await expect(
    page
      .locator(".admin-stats > div")
      .filter({ hasText: "Net payments received" })
      .locator("strong"),
  ).toHaveText("£75.00");
  expect(
    (await request.post("/api/admin/payments/reconcile", { headers })).status(),
  ).toBe(401);
});

for (const width of [390,1440]) test(`verified purchase appears in readable admin details without a customer return at ${width}px`,async ({page,request},testInfo)=>{
  await page.setViewportSize({width,height:1000});
  await review(page);await open(page);
  const sessionId=(await state(request)).sessions[0].id;
  const success=await event(request,{sessionId,state:"paid",eventId:"evt_saved_order",overrides:{customer_details:{email:"final-contact@example.test",phone:"+447700900123"},collected_information:{shipping_details:{name:"Delivery Recipient",address:{line1:"2 Final Test Street",line2:"Flat 3",city:"London",postal_code:"SW1A 1AA",country:"GB"}}}}});
  expect(success.status).toBe(200);
  // No customer confirmation page is visited: the signed webhook creates the admin result.
  await page.goto("http://127.0.0.1:3107/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");await page.getByLabel("Password",{exact:true}).fill("Test-password-only-123");await page.getByRole("button",{name:"Continue securely"}).click();
  await page.getByLabel("Authenticator code").fill("123456");await page.getByRole("button",{name:"Open workspace"}).click();await expect(page.getByRole("heading",{name:"Overview",exact:true})).toBeVisible({timeout:15000});
  await page.goto("/admin/orders");await page.getByLabel("Filter order environment").selectOption("test");await page.getByLabel("Filter payment status").selectOption("paid");
  const record=page.locator(".admin-record");await expect(record).toHaveCount(1);await record.locator(":scope > summary").click();
  await expect(record.getByRole("region",{name:"Customer contact"})).toContainText("final-contact@example.test");
  await expect(record).toContainText("final-contact@example.test");await expect(record).toContainText("Delivery Recipient");await expect(record).toContainText("2 Final Test Street");await expect(record).toContainText("+447700900123");
  await expect(record.locator(".admin-order-items tbody tr")).toContainText("Layla Burgundy Abaya");await expect(record.locator(".admin-order-items tbody td")).toHaveText(["54","2","£75.00","£150.00"]);
  await expect(record.locator(".admin-order-totals")).toContainText("£150.00");await expect(record.locator("pre")).toHaveCount(0);
  const verified=record.locator(".admin-order-overview dl > div").filter({has:page.locator("dt",{hasText:"Order confirmed"})});await expect(verified).not.toContainText("Not recorded");
  await record.getByLabel("Internal notes").fill("Keep purchase note");await record.getByRole("button",{name:"Save fulfilment details"}).click();await expect(page.getByText("Saved successfully.",{exact:true})).toBeVisible();
  expect((await event(request,{sessionId,state:"paid",eventId:"evt_saved_order"})).status).toBe(200);
  await page.reload();await page.getByLabel("Filter order environment").selectOption("test");await expect(page.locator(".admin-record")).toHaveCount(1);await page.locator(".admin-record > summary").click();await expect(page.getByLabel("Internal notes")).toHaveValue("Keep purchase note");
  const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Export CSV",exact:true}).click();const download=await downloading;const stream=await download.createReadStream();let csv="";for await(const chunk of stream!)csv+=chunk.toString();expect(csv).toContain("final-contact@example.test");expect(csv).toContain("Layla Burgundy Abaya");expect(csv).toContain("15000");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`admin-purchase-${width}.png`),fullPage:true});
});

test.describe("Android touch payment", () => {
  test.use({
    viewport: devices["Pixel 5"].viewport,
    isMobile: true,
    hasTouch: true,
  });
  test("touch checkout opens without newer browser crypto or AbortSignal APIs", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(AbortSignal, "any", { value: undefined });
      Object.defineProperty(AbortSignal, "timeout", { value: undefined });
      Object.defineProperty(crypto, "randomUUID", { value: undefined });
    });
    await review(page);
    await open(page);
  });
});
