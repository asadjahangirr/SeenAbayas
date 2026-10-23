"use client";
import { useEffect, useState } from "react";
import { adminRequest } from "@/lib/admin/client";
export function EmailConfirmation() {
  const [token,setToken]=useState("");const [busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
  useEffect(()=>{setToken(new URLSearchParams(location.search).get("token")||"");history.replaceState(null,"","/admin/email-confirmation");},[]);
  async function confirm(){setBusy(true);setError("");try{await adminRequest({action:"confirm-email",token},"/api/admin/auth");setToken("");setDone(true);}catch(error){setError(error instanceof Error?error.message:"Please try again.");}finally{setBusy(false);}}
  return <div className="admin-login"><div className="admin-login__card"><p className="admin-eyebrow">SEEN ABAYAS</p><h1>{done?"Your email is verified.":"Confirm your email."}</h1><p>{done?"You can now sign in with your username or email and receive password-reset links at this address.":"Confirm this address for your administrator account. This does not change your password."}</p>{error&&<p role="alert" className="admin-error">{error}</p>}{!done&&<button className="admin-primary" disabled={!token||busy} onClick={()=>void confirm()}>{busy?"Confirming…":"Confirm my email"}</button>}<a href="/admin/login">Continue to sign in</a></div></div>;
}
