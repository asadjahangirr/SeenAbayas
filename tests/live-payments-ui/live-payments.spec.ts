import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import AxeBuilder from "@axe-core/playwright";

const headers={Origin:"http://127.0.0.1:3107","Content-Type":"application/json"};
const details={email:"live-fixture@example.test",firstName:"Test",lastName:"Shopper",phone:"",addressLine1:"1 Example Street",addressLine2:"",city:"London",postcode:"SW1A 1AA",country:"GB"};
test.beforeEach(async({request})=>{await request.get("http://127.0.0.1:3106/__test/reset");await request.get("http://127.0.0.1:3108/__test/reset");});

test("live FAQs and policies explain active checkout without hiding outstanding business review", async ({ page }) => {
  await page.goto("/faqs");
  await page.getByText("How do I place an order?", { exact: true }).click();
  await expect(page.locator("#ordering")).toContainText("confirmed after payment is verified");
  await page.getByText("Which payment methods do you accept?", { exact: true }).click();
  await expect(page.locator("#payments")).toContainText("Secure checkout supports card payments");
  await expect(page.locator("#payments")).not.toContainText("Real-money payments are not enabled");
  await page.goto("/terms-conditions");
  await expect(page.locator("#ordering")).toContainText("confirmed store order only after verification");
  await expect(page.locator("#prices-payments")).toContainText("current checkout adds no tax");
  await expect(page.getByRole("complementary", { name: "Policy preview notice" })).toBeVisible();
  await page.goto("/privacy-policy");
  await expect(page.locator("#information")).toContainText("private order in Supabase");
  await expect(page.locator("#information")).toContainText("secure browser cookie");
  await expect(page.locator("#providers")).toContainText("Resend delivers customer confirmations");
  await expect(page.locator("#future-features")).not.toContainText("real-money payments");
});
for(const width of [393,1440]) test(`simulated live success deducts once and shows a verified order at ${width}px`,async({page,request})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/collection/design-01");await page.getByRole("button",{name:"54",exact:true}).click();await page.getByRole("button",{name:"Add to bag",exact:true}).click();
  const drawer=page.getByRole("dialog",{name:/^Your bag/});await expect(drawer).toBeVisible();await drawer.getByRole("button",{name:"Increase quantity"}).click();await expect(drawer.locator(".bag-subtotal strong")).toHaveText("£150.00");
  await drawer.getByRole("button",{name:"Close shopping bag",exact:true}).click();await page.goto("/checkout");
  await expect(page.locator(".checkout-preview")).toContainText("Secure checkout");await expect(page.locator(".checkout-totals")).toContainText("£0.00");
  for(const [field,value] of Object.entries(details))if(field!=="country")await page.locator(`#checkout-${field}`).fill(value);
  await page.getByRole("button",{name:"Review your details",exact:true}).click();
  await expect(page.locator(".checkout-payment")).not.toContainText("No real money");
  await page.route("https://checkout.stripe.com/**",route=>route.fulfill({contentType:"text/html",body:"<body>Isolated live-mode simulator; no charges</body>"}));
  const opening=page.waitForResponse(r=>r.url().endsWith("/api/checkout/session")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Continue to secure payment",exact:true}).click();const opened=await opening;expect(opened.status()).toBe(200);await expect(page).toHaveURL(/^https:\/\/checkout.stripe.com\//);
  const state=await(await request.get("http://127.0.0.1:3108/__test/state")).json();const orderId=state.sessions[0].metadata.order_id;expect(state.sessions[0].livemode).toBe(true);expect(state.stock[0]).toEqual({on_hand:5,reserved:2});
  for(let i=0;i<2;i++)expect((await(await request.post("http://127.0.0.1:3108/__test/event",{data:{sessionId:state.sessions[0].id,state:"paid",eventId:"evt_live_fixture"}})).json()).status).toBe(200);
  await page.goto(`/order-confirmation?order=${orderId}`);await expect(page.getByRole("heading",{name:"Thank you. Your order is confirmed.",exact:true})).toBeVisible();
  await expect(page.locator(".confirmation-reference")).toContainText("Order reference");
  await expect(page.locator(".confirmation-reference")).not.toContainText("Test reference");
  await expect.poll(async()=>page.evaluate(()=>localStorage.getItem("seen.bag.v1"))).toBeNull();
  const after=await(await request.get("http://127.0.0.1:3108/__test/state")).json();expect(after.stock[0]).toEqual({on_hand:3,reserved:0});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
});

test("live mode blocks unknown delivery rates and tampered or stale payment-mode reviews",async({page,request})=>{
  await page.goto("/collection/design-01");await page.getByRole("button",{name:"54",exact:true}).click();await page.getByRole("button",{name:"Add to bag",exact:true}).click();await expect(page.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
  const lines=await page.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
  const review=await(await page.request.post("/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines}})).json();expect(review.mode).toBe("live");expect(review.paymentAvailable).toBe(false);
  const response=await page.request.post("/api/checkout/session",{headers,data:{details,shippingMethod:"standard",lines,requestId:randomUUID(),reviewFingerprint:review.reviewFingerprint}});expect(response.status()).toBe(409);
  const two=lines.map((line:{variantId:string})=>({...line,quantity:2}));
  const valid=await(await page.request.post("/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines:two}})).json();expect(valid.paymentAvailable).toBe(true);
  expect((await page.request.post("/api/checkout/session",{headers,data:{details,shippingMethod:"standard",lines:two,requestId:randomUUID(),reviewFingerprint:"0".repeat(64)}})).status()).toBe(409);
  expect((await(await request.get("http://127.0.0.1:3108/__test/state")).json()).sessions).toHaveLength(0);
});

test("separate sandbox credentials verify old test events while active checkout is live",async({page,request})=>{
  await page.goto("/collection/design-01");await page.getByRole("button",{name:"54",exact:true}).click();await page.getByRole("button",{name:"Add to bag",exact:true}).click();await expect(page.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
  const lines=(await page.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines)).map((line:{variantId:string})=>({variant_id:line.variantId,quantity:2,unit_price_pence:7500}));
  const secret={apikey:"sb_secret_SEEN_LOCAL_FIXTURE_ONLY",Authorization:"Bearer sb_secret_SEEN_LOCAL_FIXTURE_ONLY"};
  const prepared=await request.post("http://127.0.0.1:3106/rest/v1/rpc/payment_prepare_order",{headers:secret,data:{request_id:randomUUID(),owner_hash:"a".repeat(64),request_hash:"b".repeat(64),details,requested_lines:lines,shipping_method:"standard",expected_delivery:0,return_origin:"http://127.0.0.1:3107"}});expect(prepared.status()).toBe(200);const order=await prepared.json();
  // Create a sandbox provider session directly in the isolated simulator only.
  const params=new URLSearchParams({"allowed_payment_method_types[0]":"card","allowed_payment_method_types[1]":"klarna","allowed_payment_method_types[2]":"afterpay_clearpay","line_items[0][quantity]":"2","line_items[0][price_data][unit_amount]":"7500","metadata[order_id]":order.id,"metadata[request_hash]":order.request_hash,client_reference_id:order.id});
  const session=await(await request.post("http://127.0.0.1:3108/v1/checkout/sessions",{headers:{Authorization:"Bearer sk_test_SEEN_LOCAL_FIXTURE_ONLY","Content-Type":"application/x-www-form-urlencoded"},data:params.toString()})).json();
  expect((await(await request.post("http://127.0.0.1:3108/__test/event",{data:{sessionId:session.id,state:"paid"}})).json()).status).toBe(200);
  expect((await(await request.get("http://127.0.0.1:3108/__test/state")).json()).stock[0]).toEqual({on_hand:5,reserved:0});
});
