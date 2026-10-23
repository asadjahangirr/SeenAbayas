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


for(const mixed of [false,true])test(mixed?"mixed products get GBP 90 checkout with free standard multi-parcel delivery":"two of the same garment get free standard delivery at exactly GBP 80",async({page,browser,request})=>{
  test.setTimeout(90000);await setup(page);await publish(page);
  let snapshot=await(await page.request.get("/api/admin")).json();
  for(const [reference,price] of [["design-01",4000],["design-02",5000]] as const){
    const raw=snapshot.products.find((p:any)=>p.design_reference===reference);
    const response=await page.request.post("/api/admin",{headers,data:{action:"product",updatedAt:raw.updated_at,product:{
      id:raw.id,design_reference:raw.design_reference,name:raw.name,description:raw.description,price_pence:price,cost_pence:raw.cost_pence,
      status:"published",details_confirmed:true,sort_order:raw.sort_order,photos:raw.photos,category:raw.category,tone:raw.tone,
      variants:raw.variants.map((v:any)=>({id:v.id,size_label:v.size_label,sku:v.sku,active:v.active,on_hand:v.on_hand}))
    }}});expect(response.status(),await response.text()).toBe(200);
  }
  snapshot=await(await page.request.get("/api/admin")).json();
  const document=snapshot.site.draft;document.commerce.freeDeliveryEnabled=true;document.commerce.freeDeliveryThresholdPence=8000;
  document.shipping.maxItemsPerParcel=1;
  for(const p of snapshot.products.filter((p:any)=>["design-01","design-02"].includes(p.design_reference)))
    for(const v of p.variants)document.shipping.variantWeights[v.id]=p.design_reference==="design-01"?400:600;
  expect((await page.request.post("/api/admin",{headers,data:{action:"site",input:{document,version:snapshot.site.version,publish:true}}})).status()).toBe(200);
  const context=await browser.newContext({viewport:{width:mixed?393:1440,height:900}});
  try{
    const shop=await context.newPage();await shop.goto("http://127.0.0.1:3107/collection/design-01");
    await shop.getByRole("button",{name:"54",exact:true}).click();await shop.getByRole("button",{name:"Add to bag",exact:true}).click();
    await expect(shop.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
    if(mixed){
      await shop.goto("http://127.0.0.1:3107/collection/design-02");await shop.getByRole("button",{name:"54",exact:true}).click();
      await shop.getByRole("button",{name:"Add to bag",exact:true}).click();
      await expect(shop.getByRole("dialog",{name:/^Your bag/})).toBeVisible();
    }else{
      await shop.getByRole("button",{name:"Increase quantity",exact:true}).click();
      await expect(shop.getByLabel("Quantity 2",{exact:true})).toBeVisible();
    }
    const lines=await shop.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
    await shop.goto("http://127.0.0.1:3107/checkout");
    await expect(shop.locator(".checkout-total dd")).toHaveText(mixed?"\u00a390.00":"\u00a380.00");
    for(const [field,value]of Object.entries(details))if(field!=="country")await shop.locator('#checkout-'+field).fill(value);
    await shop.getByRole("button",{name:"Review your details",exact:true}).click();await expect(shop.locator(".checkout-review")).toBeVisible();
    await expect(shop.locator(".checkout-total dd")).toHaveText(mixed?"\u00a390.00":"\u00a380.00");
    expect(await shop.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const response=await shop.request.post("/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines}});expect(response.status()).toBe(200);
    const review=await response.json();expect(review.delivery).toMatchObject({chargePence:0,carrierCostPence:850,parcels:[
      {weightInGrams:mixed?700:500,quantity:1,carrierCostPence:425},{weightInGrams:500,quantity:1,carrierCostPence:425}
    ]});
    const opened=await shop.request.post("/api/checkout/session",{headers,data:{details,shippingMethod:"standard",lines,requestId:randomUUID(),reviewFingerprint:review.reviewFingerprint,shippingQuote:review.shippingQuote}});
    expect(opened.status(),await opened.text()).toBe(200);
    const state=await(await request.get("http://127.0.0.1:3108/__test/state")).json();expect(state.sessions[0].amount_total).toBe(mixed?9000:8000);
    expect(state.stock[0].reserved).toBe(mixed?1:2);
  }finally{await context.close();}
});


for(const code of ["freedel","SAVE10"])test('bag and checkout apply '+code+' with a verified paid order',async({page,browser,request})=>{
  test.setTimeout(90000);await page.setViewportSize({width:code==="freedel"?393:1440,height:900});await setup(page);await publish(page);
  if(code==="SAVE10"){
    const response=await page.request.post("/api/admin",{headers,data:{action:"record",input:{kind:"coupon",id:null,version:0,data:{code,type:"percent",value:10,min_subtotal_pence:0,active:true,expires_at:null,usage_limit:1}}}});
    expect(response.status(),await response.text()).toBe(200);
  }
  const context=await browser.newContext({viewport:{width:code==="freedel"?393:1440,height:900}});
  try{
    const shop=await context.newPage();await shop.goto("http://127.0.0.1:3107/collection/design-01");
    await shop.getByRole("button",{name:"54",exact:true}).click();await shop.getByRole("button",{name:"Add to bag",exact:true}).click();
    await expect(shop.getByRole("dialog",{name:/^Your bag/})).toBeVisible();await shop.goto("http://127.0.0.1:3107/bag");
    await shop.getByLabel("Discount code",{exact:true}).fill(code);await shop.getByRole("button",{name:"Apply",exact:true}).click();
    await expect(shop.locator(".discount-code__success")).toContainText(code.toUpperCase());
    if(code==="SAVE10")await expect(shop.locator(".bag-page .bag-subtotal").filter({hasText:"After discount"})).toContainText('\u00a367.50');
    await shop.goto("http://127.0.0.1:3107/checkout");await expect(shop.locator(".discount-code__success")).toContainText(code.toUpperCase());
    for(const[field,value]of Object.entries(details))if(field!=="country")await shop.locator('#checkout-'+field).fill(value);
    await shop.getByRole("button",{name:"Review your details",exact:true}).click();await expect(shop.locator(".checkout-review")).toBeVisible();
    await expect(shop.locator(".checkout-total dd")).toHaveText(code==="freedel"?'\u00a375.00':'\u00a371.75');
    expect(await shop.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    const lines=await shop.evaluate(()=>JSON.parse(localStorage.getItem("seen.bag.v1")!).lines);
    const response=await shop.request.post("/api/checkout/review",{headers,data:{details,shippingMethod:"standard",lines,couponCode:code}});expect(response.status()).toBe(200);
    const review=await response.json();
    const opened=await shop.request.post("/api/checkout/session",{headers,data:{details,shippingMethod:"standard",lines,couponCode:code,requestId:randomUUID(),reviewFingerprint:review.reviewFingerprint,shippingQuote:review.shippingQuote}});
    expect(opened.status(),await opened.text()).toBe(200);const order=await opened.json();
    const state=await(await request.get("http://127.0.0.1:3108/__test/state")).json();expect(state.sessions[0].amount_total).toBe(code==="freedel"?7500:7175);
    const paid=await request.post("http://127.0.0.1:3108/__test/event",{data:{sessionId:state.sessions[0].id,state:"paid"}});expect((await paid.json()).status).toBe(200);
    await shop.goto('http://127.0.0.1:3107/order-confirmation?order='+order.orderId);await expect(shop.getByRole("heading",{name:"Thank you. Your order is confirmed.",exact:true})).toBeVisible();
    await expect(shop.locator(".checkout-totals")).toContainText(code.toUpperCase());
    const snapshot=await(await page.request.get("/api/admin")).json();const saved=snapshot.records.find((r:any)=>r.id===order.orderId);
    expect(saved.payload.coupon.code).toBe(code.toUpperCase());expect(saved.payload.total_pence).toBe(code==="freedel"?7500:7175);
  }finally{await context.close();}
});

test("invalid codes show clear feedback, removing a code restores the charge, and owners can create free-delivery codes",async({page,browser})=>{
  test.setTimeout(90000);await setup(page);await publish(page);await page.goto("/admin/coupons");
  const add=page.locator("details.admin-entity-form").filter({has:page.getByText("Add coupon",{exact:true})});await add.locator("summary").click();
  await add.getByLabel("Coupon code",{exact:true}).fill("NEWFREE");await add.getByRole("combobox",{name:"Discount type",exact:true}).selectOption("free_delivery");
  await expect(add.getByLabel("Discount (%)",{exact:true})).toHaveCount(0);await add.getByRole("button",{name:"Save coupon",exact:true}).click();
  await expect(page.getByText("NEWFREE",{exact:true})).toBeVisible();
  const context=await browser.newContext();
  try{
    const shop=await context.newPage();await shop.goto("http://127.0.0.1:3107/collection/design-01");await shop.getByRole("button",{name:"54",exact:true}).click();await shop.getByRole("button",{name:"Add to bag",exact:true}).click();
    await expect(shop.getByRole("dialog",{name:/^Your bag/})).toBeVisible();await shop.goto("http://127.0.0.1:3107/bag");
    await shop.getByLabel("Discount code",{exact:true}).fill("UNKNOWN");await shop.getByRole("button",{name:"Apply",exact:true}).click();await expect(shop.locator(".discount-code__error")).toContainText("unavailable");
    await shop.getByLabel("Discount code",{exact:true}).fill("newfree");await shop.getByRole("button",{name:"Apply",exact:true}).click();await expect(shop.locator(".discount-code__success")).toContainText("NEWFREE");
    await shop.getByRole("button",{name:"Remove code",exact:true}).click();await expect(shop.getByLabel("Discount code",{exact:true})).toHaveValue("");
    await shop.goto("http://127.0.0.1:3107/checkout");
    for(const[field,value]of Object.entries(details))if(field!=="country")await shop.locator('#checkout-'+field).fill(value);
    await shop.getByRole("button",{name:"Review your details",exact:true}).click();await expect(shop.locator(".checkout-review")).toBeVisible();await expect(shop.locator(".checkout-total dd")).toHaveText('\u00a379.25');
  }finally{await context.close();}
});
