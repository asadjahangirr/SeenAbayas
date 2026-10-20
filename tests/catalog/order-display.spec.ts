import { test, expect } from "@playwright/test";
import { orderDetails, orderCsv } from "../../src/lib/admin/orders";
import type { AdminRecord } from "../../src/lib/admin/model";

const record:AdminRecord={id:"10000000-0000-4000-8000-000000000099",kind:"order",version:1,created_at:"2026-10-20T12:00:00Z",updated_at:"2026-10-20T12:00:00Z",payload:{order_number:"SEEN-T-TEST",is_test:true,name:"Recipient",email:"buyer@example.test",payment_status:"paid",checkout_state:"paid",items:[{name:"=UNTRUSTED()",size:"54",quantity:2,unit_price_pence:4500,line_total_pence:1}],address:{firstName:"Contact",lastName:"Name",recipientName:"Recipient",addressLine1:"1 Test Street",city:"London",postcode:"SW1A 1AA",country:"GB"},subtotal_pence:9000,delivery_pence:0,total_pence:9000}};
test("admin purchase display uses saved prices and separates contact and recipient",()=>{
  const detail=orderDetails(record);expect(detail.contactName).toBe("Contact Name");expect(detail.recipientName).toBe("Recipient");expect(detail.items[0].lineTotalPence).toBe(9000);expect(detail.paymentLabel).toBe("Paid");
  expect(orderDetails({...record,payload:{...record.payload,checkout_state:"pending",payment_status:"unpaid"}}).paymentLabel).toBe("Awaiting payment confirmation");
});
test("old records show missing information honestly and CSV guards formulas",()=>{
  const old=orderDetails({...record,payload:{name:"Old customer"}});expect(old.items).toEqual([]);expect(old.subtotalPence).toBeNull();expect(old.address).toEqual([]);
  const csv=orderCsv([record]);expect(csv).toContain("'=UNTRUSTED()");expect(csv).toContain("9000");expect(csv).toContain("buyer@example.test");expect(csv).not.toContain("owner_hash");
});
