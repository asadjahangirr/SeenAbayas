import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
test.use({ actionTimeout: 15000 });
const headers = { Origin: "http://127.0.0.1:3107", "Content-Type": "application/json" };
const details = { email:"shipping@example.test",firstName:"Test",lastName:"Shopper",phone:"",addressLine1:"1 Example Street",addressLine2:"",city:"London",postcode:"SW1A 1AA",country:"GB" };
async function publish(page:Page) {
  await page.getByRole("button",{name:"Save & update store",exact:true}).click();
  await expect(page.getByText("Published. Your changes",{exact:false})).toBeVisible();
}
async function setup(page:Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password",{exact:true}).fill("Test-password-only-123");
  await page.getByRole("button",{name:"Continue securely"}).click();

  await expect(page.getByRole("heading",{name:"Overview",exact:true})).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByRole("combobox",{name:"Royal Mail account type",exact:true}).selectOption("olp");
  await page.getByLabel("Dispatch postcode",{exact:true}).fill("SW1A 1AA");
  for (const [label,value] of [["Empty packaging weight (g)","100"],["Packed parcel length (cm)","30"],["Packed parcel width (cm)","20"],["Packed parcel height (cm)","10"],["Maximum pieces this parcel holds","2"],["Standard Royal Mail service code","TEST48"],["Express Royal Mail service code","TEST24"]]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole("combobox",{name:"Royal Mail price interpretation",exact:true}).selectOption("cost_plus_vat");
  const panel=page.locator("section").filter({has:page.getByRole("heading",{name:"Royal Mail & parcel setup",exact:true})});
  await panel.locator("summary").filter({hasText:"Layla Burgundy Abaya"}).click();
  await page.getByLabel("Layla Burgundy Abaya · size 54 weight (g)",{exact:true}).fill("400");
  await page.getByRole("combobox",{name:"Delivery calculation",exact:true}).selectOption("royal_mail_olp");
}
test.beforeEach(async({request})=>{ await request.get("http://127.0.0.1:3106/__test/reset");await request.get("http://127.0.0.1:3108/__test/reset"); });

for (const width of [393,1440]) test(`editable parcels produce private, signed carrier checkout at ${width}px`,async({page,browser,request})=>{
  test.setTimeout(90000); await page.setViewportSize({width,height:900}); await setup(page);
  await page.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByText("Draft saved.",{exact:false})).toBeVisible();
  expect(await(await request.post("http://127.0.0.1:3106/rest/v1/rpc/get_site_document",{data:{}})).json()).toBeNull();
  await publish(page);
  const publicDoc=await(await request.post("http://127.0.0.1:3106/rest/v1/rpc/get_site_document",{data:{}})).json();
  expect(publicDoc.shipping).toEqual({mode:"royal_mail_olp"});
  await page.reload();
  await expect(page.getByLabel("Packed parcel length (cm)",{exact:true})).toHaveValue("30");
  await expect(page.getByLabel("Dispatch postcode",{exact:true})).toHaveValue("SW1A 1AA");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  const context=await browser.newContext({viewport:{width,height:900}});
  try {
    const shop=await context.newPage();await shop.goto("http://127.0.0.1:3107/collection/design-01");
    await shop.getByRole("button",{name:"54",exact:true}).click();await shop.getByRole("button",{name:"Add to bag",exact:true}).click();
    await expect(shop.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
    const lines=await shop.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
    await shop.goto("http://127.0.0.1:3107/checkout");
    for(const [field,value] of Object.entries(details))if(field!=="country")await shop.locator(`#checkout-${field}`).fill(value);
    await shop.getByRole("button",{name:"Review your details",exact:true}).click();
    await expect(shop.locator(".checkout-review")).toBeVisible();
    await expect(shop.locator(".checkout-total dd")).toHaveText("£79.25");
    const review=async()=>{const r=await shop.request.post("http://127.0.0.1:3107/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines}});expect(r.status()).toBe(200);return r.json();};
    const current=await review();
    const pay=async(quoted=current)=>shop.request.post("http://127.0.0.1:3107/api/checkout/session",{headers,data:{details,shippingMethod:"standard",lines,requestId:randomUUID(),reviewFingerprint:quoted.reviewFingerprint,shippingQuote:quoted.shippingQuote}});
    expect((await pay({...current,shippingQuote:current.shippingQuote+"x"})).status()).toBe(409);
    await page.getByLabel("Empty packaging weight (g)",{exact:true}).fill("101");await publish(page);
    expect((await pay()).status()).toBe(409);
    await page.getByLabel("Free delivery threshold (£)",{exact:true}).fill("75");await publish(page);
    const free=await review();expect(free).toMatchObject({estimatedTotalPence:7500,delivery:{chargePence:0,carrierCostPence:425,weightInGrams:501}});
    const opened=await pay(free);expect(opened.status()).toBe(200);
    const state=await(await request.get("http://127.0.0.1:3108/__test/state")).json();
    expect(state.sessions[0]).toMatchObject({amount_total:7500,livemode:true});expect(state.stock[0]).toEqual({on_hand:5,reserved:1});
    expect((await(await request.post("http://127.0.0.1:3108/__test/event",{data:{sessionId:state.sessions[0].id,state:"paid"}})).json()).status).toBe(200);
    const order=await opened.json();await shop.goto(`http://127.0.0.1:3107/order-confirmation?order=${order.orderId}`);
    await expect(shop.getByRole("heading",{name:"Thank you. Your order is confirmed.",exact:true})).toBeVisible();
    expect((await(await request.get("http://127.0.0.1:3108/__test/state")).json()).stock[0]).toEqual({on_hand:4,reserved:0});
  } finally {await context.close();}
});

test("missing parcel data and provider outages cannot fall back to free delivery or create orders",async({page,request})=>{
  test.setTimeout(60000);await setup(page);
  await page.getByLabel("Layla Burgundy Abaya · size 54 weight (g)",{exact:true}).fill("");
  await publish(page);
  const context=await page.context().browser()!.newContext();
  try {
    const shop=await context.newPage();await shop.goto("http://127.0.0.1:3107/collection/design-01");
    await shop.getByRole("button",{name:"54",exact:true}).click();await shop.getByRole("button",{name:"Add to bag",exact:true}).click();
    await expect(shop.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
    const lines=await shop.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
    const bad=await shop.request.post("http://127.0.0.1:3107/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines}});
    expect(bad.status()).toBe(503);expect((await bad.json()).error).toContain("measurements");
    const publicCatalog=await(await request.post("http://127.0.0.1:3106/rest/v1/rpc/admin_snapshot",{headers:{Authorization:"Bearer invalid"},data:{}})).json();
    expect(publicCatalog).not.toHaveProperty("products");
    await page.getByLabel("Layla Burgundy Abaya · size 54 weight (g)",{exact:true}).fill("400");await publish(page);
    await page.goto("/collection/design-01");await page.getByRole("button",{name:"54",exact:true}).click();await page.getByRole("button",{name:"Add to bag",exact:true}).click();
    await expect(page.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
    const valid=await page.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
    await request.post("http://127.0.0.1:3108/__test/recovery",{data:{unavailable:true}});
    expect((await page.request.post("/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines:valid}})).status()).toBe(503);
    const state=await(await request.get("http://127.0.0.1:3108/__test/state")).json();expect(state.sessions).toHaveLength(0);expect(state.stock[0]).toEqual({on_hand:5,reserved:0});
  } finally {await context.close();}
});
