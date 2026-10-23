"use client";
import { useState, type FormEvent } from "react";
import { adminRequest } from "@/lib/admin/client";
export function ChangeEmail() {
  const [email,setEmail]=useState(""),[current,setCurrent]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");setDone(false);try{
    await adminRequest({action:"email",email,current},"/api/admin/auth");setCurrent("");setDone(true);
  }catch(error){setError(error instanceof Error?error.message:"Please try again.");}finally{setBusy(false);}}
  return <section className="admin-panel"><div className="admin-panel__heading"><h2>Add or change your recovery email</h2><p>We will send a verification link to this address. After confirming it, you can use it to sign in or reset a forgotten password. Your username stays the same.</p></div>
    <form className="admin-form-stack" onSubmit={submit}>
      <label className="admin-field">New login email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <label className="admin-field">Current password<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={event=>setCurrent(event.target.value)}/></label>
      {error&&<p role="alert" className="admin-error">{error}</p>}{done&&<p role="status" className="admin-success">Verification requested. Check your new inbox and confirm the address. Your existing sign-in details work until you confirm it.</p>}
      <button className="admin-primary" disabled={busy}>{busy?"Sending verification...":"Send verification email"}</button>
    </form>
  </section>;
}
