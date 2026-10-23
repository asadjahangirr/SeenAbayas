import "server-only";
import { paymentRpc } from "@/lib/payments/server";
import { couponSnapshotSchema, couponCodeSchema, type CheckoutCoupon } from "./model";
import type { CheckoutReview } from "@/lib/checkout/model";
import { PaymentError } from "@/lib/payments/model";

export async function checkCoupon(code: string | undefined, subtotal: number, mode: "test" | "live"): Promise<CheckoutCoupon | undefined> {
  const canonical=couponCodeSchema.parse(code || "");
  if (!canonical) return undefined;
  const data=await paymentRpc<unknown>("checkout_coupon_quote", { code:canonical,subtotal_pence:subtotal,payment_mode:mode });
  const parsed=couponSnapshotSchema.safeParse(data);
  if(!parsed.success) throw new PaymentError("This discount code is unavailable. Check the code and try again.",409);
  return parsed.data;
}
export function applyCoupon(review: CheckoutReview, coupon: CheckoutCoupon | undefined) {
  if (!coupon) return;
  review.coupon=coupon;review.discountPence=coupon.discountPence;
  if(coupon.freeDelivery){
    review.bag={...review.bag,freeDelivery:true};
    if(review.delivery.id==="standard")review.delivery={...review.delivery,chargePence:0};
  }
  if(review.delivery.chargePence!==null)review.estimatedTotalPence=review.bag.subtotalPence-coupon.discountPence+review.delivery.chargePence;
}
