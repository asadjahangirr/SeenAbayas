"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adminRequest } from "@/lib/admin/client";
type TeamMember = { id:string; username:string|null; displayName:string; role:string; active:boolean; email:string|null; emailVerified:boolean };
export function AccountTeam({ owner }: { owner:boolean }) {
  const [profile,setProfile]=useState<{username:string|null;email:string|null;emailVerified:boolean;team:TeamMember[]}|null>(null);
  const [username,setUsername]=useState("seenabaya"),[name,setName]=useState("SEEN ABAYAS"),[password,setPassword]=useState(""),[current,setCurrent]=useState(""),[role,setRole]=useState("owner");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function load(){ const response=await fetch("/api/admin/accounts",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error);setProfile(data); }
  useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
  async function create(event:FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");try{
    await adminRequest({action:"create-admin",input:{username,displayName:name,password,current,role}},"/api/admin/auth");
    setPassword("");setCurrent("");setMessage(`Administrator ${username} created. They can sign in with this username, then add their own recovery email.`);await load();
  }catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}
  return <section className="admin-panel"><div className="admin-panel__heading"><h2>Your sign-in & recovery</h2><p>A username lets you sign in before adding an email. Email recovery starts after your address is verified.</p></div>
    {profile && <div className="admin-account-summary"><p><strong>Username:</strong> {profile.username || "Sign in with your email"}</p><p><strong>Recovery email:</strong> {profile.email || "Not added yet"}</p>{!profile.emailVerified&&<p className="admin-warning">Add and verify your email below so you can reset a forgotten password.</p>}</div>}
    {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-success">{message}</p>}
    {owner&&<><h3>Administrators</h3>{profile?.team.map(member=><div className="admin-list-row" key={member.id}><span><strong>{member.username||member.displayName}</strong><small>{member.email || "Recovery email not added"}</small></span><span>{member.role === "owner" ? "Store owner" : "Website editor"}{!member.active&&" · Access disabled"}</span></div>)}
      <details className="admin-help"><summary>Add an administrator</summary><p>Choose a username and temporary password. The new person can add their own email after signing in. Passwords are never shown again here.</p><form className="admin-form-stack" onSubmit={create}>
        <label className="admin-field">Username<input autoComplete="off" pattern="[a-z][a-z0-9._-]{2,39}" minLength={3} maxLength={40} required value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label>
        <label className="admin-field">Administrator name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label className="admin-field">Access level<select value={role} onChange={e=>setRole(e.target.value)}><option value="owner">Store owner — all store settings</option><option value="editor">Website editor — products and appearance</option></select></label>
        <label className="admin-field">Temporary password (at least 14 characters)<input type="password" autoComplete="new-password" minLength={14} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label className="admin-field">Your current password<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
        <button className="admin-primary" disabled={busy}>{busy?"Creating administrator…":"Create administrator"}</button>
      </form></details></>}
  </section>;
}
