import { z } from "zod";

export const couponCodeSchema = z.string().trim().toUpperCase().max(40).regex(/^(?:[A-Z0-9_-]{3,40})?$/);
export const couponSnapshotSchema = z.object({
  id: z.uuid(), code: couponCodeSchema.refine(Boolean), type: z.enum(["percent", "fixed", "free_delivery"]),
  value: z.number().int().nonnegative(), discountPence: z.number().int().nonnegative(),
  freeDelivery: z.boolean(), version: z.number().int().positive(),
}).strict();
export type CheckoutCoupon = z.infer<typeof couponSnapshotSchema>;

/** Allocate a verified order discount exactly, keeping original purchase snapshots intact. */
export function discountedPrices<T extends { quantity: number; unit_price_pence: number }>(items: T[], discount: number) {
  const subtotal = items.reduce((sum,item)=>sum+item.quantity*item.unit_price_pence,0);
  if (!Number.isSafeInteger(discount) || discount < 0 || discount >= subtotal) throw new Error("Invalid order discount");
  let remainder = discount;
  const reductions=items.map(item=>{
    const share=Number(BigInt(discount)*BigInt(item.quantity*item.unit_price_pence)/BigInt(subtotal));
    remainder-=share;return share;
  });
  for(let i=0;remainder>0;i++,remainder--) reductions[i]++;
  return items.flatMap((item,i)=>{
    const total=item.quantity*item.unit_price_pence-reductions[i];
    const unitAmount=Math.floor(total/item.quantity), extra=total%item.quantity;
    return [...(extra ? [{item,quantity:extra,unitAmount:unitAmount+1}] : []),
      ...(item.quantity-extra ? [{item,quantity:item.quantity-extra,unitAmount}] : [])];
  });
}
