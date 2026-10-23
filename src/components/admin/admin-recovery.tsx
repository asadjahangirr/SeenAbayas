"use client";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { adminRequest } from "@/lib/admin/client";
export function AdminRecovery() {
  const [stage,setStage]=useState("request"),[email,setEmail]=useState(""),[tokenHash,setTokenHash]=useState("");
  const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{const query=new URLSearchParams(location.search);const token=query.get("token_hash");
    if(token){setTokenHash(token);setStage("verify");history.replaceState(null,"","/admin/recover");}
    else if(query.get("stage")==="password")setStage("password");
    else if(query.has("error"))setError("This link is invalid or expired. Request a new reset email below.");
  },[]);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{
    if(stage==="request"){
      await adminRequest({action:"recover-request",email},"/api/admin/auth");
      setMessage("If this administrator has a verified email, a reset link will be sent there. Check Spam or Junk too. If you have not added an email yet, ask the store owner to help recover access.");
    }else if(stage==="verify"){
      await adminRequest({action:"recover-verify",tokenHash},"/api/admin/auth");setTokenHash("");setStage("password");
    }else{
      if(password!==confirmation)throw Error("The new passwords do not match.");
      await adminRequest({action:"recover-password",password},"/api/admin/auth");location.assign("/admin/login");
    }
  }catch(error){setError(error instanceof Error?error.message:"Please try again.");}finally{setBusy(false);}}
  return <div className="admin-login"><a href="/" className="admin-wordmark">SEEN<span>STORE MANAGEMENT</span></a><div className="admin-login__card"><KeyRound size={28}/>
    <p className="admin-eyebrow">Account recovery</p><h1>{stage==="request"?"Forgot your password?":stage==="verify"?"Reset your password.":"Choose a new password."}</h1>
    <p>{stage==="request"?"Enter your email address or username to receive a reset link at your verified email.":stage==="verify"?"Continue to verify this one-use link and choose a new password.":"Use at least 14 characters. Your other sessions will be signed out."}</p>
    <form onSubmit={submit}>{stage==="request"?<label>Email address or username<input autoComplete="username" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>:stage==="password"?<>
      <label>New password<input type="password" minLength={14} maxLength={128} autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
      <label>Confirm new password<input type="password" minLength={14} maxLength={128} autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label></>:null}
      {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-success">{message}</p>}
      <button className="admin-primary" disabled={busy}>{busy?"Please wait...":stage==="request"?"Request recovery link":stage==="verify"?"Open password reset":"Reset password securely"}</button>
    </form><a href="/admin/login">Return to sign in</a></div></div>;
}
