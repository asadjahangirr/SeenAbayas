import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { couponCodeSchema } from "@/lib/coupons/model";
import { parseBagLines } from "@/lib/bag/model";
import { getBagState } from "@/lib/bag/server";
import { assertPaymentOrigin,readPaymentBody } from "@/lib/payments/http";
import { PaymentError } from "@/lib/payments/model";
import { readyPaymentMode,paymentRpc } from "@/lib/payments/server";
import { couponSnapshotSchema } from "@/lib/coupons/model";
export const runtime="nodejs";
export async function POST(request:Request){
  const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
  try{
    assertPaymentOrigin(request);
    const body=z.object({code:couponCodeSchema.refine(Boolean),lines:z.unknown()}).strict().parse(await readPaymentBody(request));
    const lines=parseBagLines(body.lines);if(!lines?.length)throw new PaymentError("Add an available piece to your bag first.",400);
    const mode=await readyPaymentMode();if(!mode)throw new PaymentError("Discount codes are not available in preview.",409);
    const {quote}=await getBagState(lines);
    if(quote.lines.some(line=>line.issue||!line.piece))throw new PaymentError("Review the unavailable items in your bag first.",409);
    const candidate=process.env.VERCEL==="1"?request.headers.get("x-vercel-forwarded-for")?.trim():undefined;
    const network=candidate&&isIP(candidate)?candidate:"shared-unconfigured-proxy";
    const networkHash=createHmac("sha256",process.env.SUPABASE_SECRET_KEY||"").update(`seen-coupon:v1:${network}`).digest("hex");
    await paymentRpc("checkout_coupon_attempt",{network_hash:networkHash});
    const coupon=couponSnapshotSchema.parse(await paymentRpc("checkout_coupon_quote",{code:body.code,subtotal_pence:quote.subtotalPence,payment_mode:mode}));
    return reply({coupon});
  }catch(error){return reply({error:error instanceof PaymentError?error.message:error instanceof z.ZodError?"Enter a valid discount code.":"We couldn't check your code. Please try again."},error instanceof PaymentError?error.status:error instanceof z.ZodError?400:503);}
}
