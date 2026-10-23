import { test, expect, type Page } from "@playwright/test";
import { adminSections, sectionNames } from "../../src/lib/admin/model";
async function login(page:Page,username="owner@example.test",password="Test-password-only-123"){
  await page.goto("/admin/login");await page.getByLabel("Email address or username").fill(username);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Continue securely"}).click();await expect(page.getByRole("heading",{name:"Overview",exact:true})).toBeVisible();
}
test.beforeEach(async({request})=>{await request.get("http://127.0.0.1:3106/__test/reset");});
for(const width of[393,1440])test(`sidebar changes all sections without server-page reloads at ${width}px`,async({page},info)=>{
  test.setTimeout(120000);await page.setViewportSize({width,height:900});await login(page);
  const slowRequests:string[]=[];
  page.on("request",request=>{const url=new URL(request.url());if(url.searchParams.has("_rsc")||url.pathname==="/api/admin")slowRequests.push(url.pathname);});
  const timings:number[]=[];
  for(const section of adminSections.filter(s=>s!=="dashboard")){
    if(width<900)await page.getByRole("button",{name:"Open admin navigation"}).click();
    const begin=Date.now();await page.getByRole("navigation",{name:"Administration"}).getByRole("link",{name:sectionNames[section],exact:true}).click();
    await expect(page.getByRole("heading",{level:1,name:sectionNames[section],exact:true})).toBeVisible();timings.push(Date.now()-begin);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }
  expect(slowRequests).toEqual([]);
  console.log(JSON.stringify({viewport:width,sectionCount:timings.length,medianClickMs:[...timings].sort((a,b)=>a-b)[Math.floor(timings.length/2)],serverPageRequests:slowRequests.length}));
  await page.goBack();await expect(page.getByRole("heading",{name:sectionNames.history,exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("heading",{name:sectionNames.history,exact:true})).toBeVisible();
  await page.goto("/admin");await page.screenshot({path:info.outputPath(`workspace-${width}.png`),fullPage:true});
});
test("page-based text editing hides internal tokens, preserves drafts and opens a protected phone preview",async({page})=>{
  test.setTimeout(90000);await login(page);await page.getByRole("navigation",{name:"Administration"}).getByRole("link",{name:"Website text",exact:true}).click();
  const options=await page.getByLabel("Filter text by page").locator("option").allTextContents();expect(options).toContain("Homepage");expect(options.some(v=>/api|route|src|component/i.test(v))).toBe(false);
  await page.getByLabel("Filter text by page").selectOption({label:"Homepage"});await page.getByRole("searchbox",{name:"Search website text"}).fill("Made to");
  const field=page.getByRole("textbox",{name:"Replacement for Made to",exact:true});await field.fill("Created to");
  page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("navigation",{name:"Administration"}).getByRole("link",{name:"Products & stock",exact:true}).click();await expect(field).toHaveValue("Created to");
  await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page.getByText("Draft saved.",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Preview saved draft",exact:true}).click();await page.getByRole("button",{name:"Phone",exact:true}).click();
  await expect(page.frameLocator('iframe[title="Saved website draft"]').locator("#film-title")).toHaveText("Created to Be Seen.");
  const live=await page.request.get("/");expect(await live.text()).toContain("Made to");
});
test("owner creates username-only client, client verifies email and resets their own password without MFA",async({page,browser,request})=>{
  test.setTimeout(120000);await login(page);await page.goto("/admin/security");await page.getByText("Add an administrator",{exact:true}).click();
  await page.getByLabel("Username",{exact:true}).fill("seenabaya");await page.getByLabel("Temporary password (at least 14 characters)").fill("Client-temporary-1234");await page.getByLabel("Your current password",{exact:true}).fill("Test-password-only-123");
  await page.getByRole("button",{name:"Create administrator",exact:true}).click();await expect(page.getByText("Administrator seenabaya created.",{exact:false})).toBeVisible();
  const client=await browser.newContext();try{
    const shop=await client.newPage();await login(shop,"seenabaya","Client-temporary-1234");await shop.goto("/admin/security");await expect(shop.getByText("Recovery email: Not added yet",{exact:true})).toBeVisible();
    const emailPanel=shop.locator("section").filter({has:shop.getByRole("heading",{name:"Add or change your recovery email",exact:true})});
    await emailPanel.getByLabel("New login email").fill("client@example.test");await emailPanel.getByLabel("Current password",{exact:true}).fill("Client-temporary-1234");await emailPanel.getByRole("button",{name:"Send verification email"}).click();await expect(emailPanel.getByRole("status")).toBeVisible();
    let messages=await(await request.get("http://127.0.0.1:3106/__test/account-emails")).json();expect(messages[0].to).toEqual(["client@example.test"]);
    const verification=messages[0].text.match(/http:\/\/127\.0\.0\.1:3107\/admin\/email-confirmation\?token=[a-f0-9]+/)[0];await shop.goto(verification);await shop.getByRole("button",{name:"Confirm my email"}).click();await expect(shop.getByRole("heading",{name:"Your email is verified."})).toBeVisible();
    await shop.goto("/admin/recover");await shop.getByLabel("Email address or username").fill("seenabaya");await shop.getByRole("button",{name:"Request recovery link"}).click();await expect(shop.locator(".admin-success[role=status]")).toContainText("verified email");
    messages=await(await request.get("http://127.0.0.1:3106/__test/account-emails")).json();const recovery=messages[1].text.match(/http:\/\/127\.0\.0\.1:3107\/admin\/recover\?token_hash=[^\s]+/)[0];
    await shop.goto(recovery);await shop.getByRole("button",{name:"Open password reset",exact:true}).click();await shop.getByLabel("New password",{exact:true}).fill("Client-updated-4567");await shop.getByLabel("Confirm new password",{exact:true}).fill("Client-updated-4567");await shop.getByRole("button",{name:"Reset password securely"}).click();await expect(shop).toHaveURL(/\/admin\/login/);
    await login(shop,"seenabaya","Client-updated-4567");expect((await page.request.get("/api/admin")).status()).toBe(200);
  }finally{await client.close();}
});
