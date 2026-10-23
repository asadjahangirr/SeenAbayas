"use client";
import { useEffect, useId, useState } from "react";
import { Copy, useContentPreview } from "@/components/cms/content-provider";
import { useBag } from "./bag-provider";
import { couponCodeSchema, couponSnapshotSchema } from "@/lib/coupons/model";
import { requestDeadline } from "@/lib/request-deadline";
import { formatGbp } from "@/lib/money";
import "./discount-code.css";

export function DiscountCode({disabled=false}:{disabled?:boolean}) {
  const {quote,ready,couponCode,coupon,setCouponCode,setCoupon}=useBag();
  const preview=useContentPreview();const id=useId();
  const [input,setInput]=useState(couponCode),[checking,setChecking]=useState(false),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const selection=JSON.stringify(quote.lines.map(({variantId,quantity})=>({variantId,quantity})));
  useEffect(()=>setInput(couponCode),[couponCode]);
  useEffect(()=>{
    setCoupon(null);setError("");
    if(!couponCode || !ready || !quote.lines.length || preview){setChecking(false);return;}
    const controller=new AbortController();const deadline=requestDeadline(20000,controller.signal);
    setChecking(true);
    void(async()=>{
      try{
        const response=await fetch("/api/checkout/coupon",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:deadline.signal,
          body:JSON.stringify({code:couponCode,lines:JSON.parse(selection)})});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"We couldn't check that code. Please try again.");
        const parsed=couponSnapshotSchema.parse(data.coupon);
        if(!controller.signal.aborted)setCoupon(parsed);
      }catch(failure){if(!controller.signal.aborted)setError(failure instanceof Error && failure.name!=="AbortError" && !(failure instanceof TypeError)?failure.message:"We couldn't check that code. Please try again.");}
      finally{deadline.dispose();if(!controller.signal.aborted)setChecking(false);}
    })();
    return()=>{controller.abort();deadline.dispose();};
  },[couponCode,selection,quote.subtotalPence,ready,preview,retry,setCoupon]);
  function apply(){
    const parsed=couponCodeSchema.safeParse(input);
    if(!parsed.success || !parsed.data){setError("Enter a valid discount code.");return;}
    setError("");setCouponCode(parsed.data);setRetry(n=>n+1);
  }
  return <div className="discount-code">
    <label id={`${id}-label`} htmlFor={id}><Copy text="Discount code" /></label>
    <div className="discount-code__entry"><input id={id} value={input} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false}
      disabled={disabled||checking||preview} aria-describedby={`${id}-status`} onChange={e=>setInput(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();apply();}}}/>
      <button type="button" disabled={disabled||checking||!ready||preview} onClick={apply}><Copy text={checking?"Checking…":"Apply"}/></button></div>
    <div id={`${id}-status`} aria-live="polite" aria-atomic="true">
      {error?<p className="discount-code__error">{error}</p>:coupon?<p className="discount-code__success">{coupon.code}: <Copy text={coupon.freeDelivery?"Free standard delivery applied.":`${formatGbp(coupon.discountPence)} discount applied.`}/></p>:<p className="discount-code__hint"><Copy text="Use one code for a discount or free standard delivery."/></p>}
    </div>
    {couponCode&&<button className="discount-code__remove" type="button" disabled={disabled||checking} onClick={()=>{setCouponCode("");setInput("");setError("");}}><Copy text="Remove code"/></button>}
  </div>;
}
