"use client";
import { useEffect, useState, type FormEvent } from "react";
import { adminRequest } from "@/lib/admin/client";
import { permissionGroups, permissionKeys } from "@/lib/admin/permissions";
type TeamMember = { id:string; username:string|null; displayName:string; active:boolean; email:string|null; mainAdmin:boolean; permissions:string[]; version:number };
function PermissionPicker({value,onChange,disabled}:{value:string[];onChange:(next:string[])=>void;disabled:boolean}) {
  return <fieldset className="admin-permissions" disabled={disabled}><legend>Allowed sections and settings</legend>
    <p>Tick only what this person should manage. Account and password settings are always available. Live publishing needs its separate permission.</p>
    <div className="admin-toolbar"><button type="button" onClick={()=>onChange([...permissionKeys])}>Select all</button><button type="button" onClick={()=>onChange([])}>Clear all</button></div>
    <div className="admin-permission-grid">{permissionGroups.map(group=><div key={group.label}><h4>{group.label}</h4>{group.options.map(([key,label])=><label className="admin-checkbox" key={key}><input type="checkbox" checked={value.includes(key)} onChange={e=>onChange(e.target.checked?[...value,key]:value.filter(v=>v!==key))}/>{label}</label>)}</div>)}</div>
  </fieldset>;
}
export function AccountTeam({ owner }: { owner:boolean }) {
  const [profile,setProfile]=useState<{username:string|null;email:string|null;emailVerified:boolean;team:TeamMember[]}|null>(null);
  const [username,setUsername]=useState(""),[name,setName]=useState(""),[password,setPassword]=useState(""),[current,setCurrent]=useState("");
  const [permissions,setPermissions]=useState<string[]>([]),[editing,setEditing]=useState<TeamMember|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function load(){const response=await fetch("/api/admin/accounts",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error);setProfile(data);}
  useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
  async function save(event:FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");try{
    if(editing)await adminRequest({action:"set-admin-permissions",input:{id:editing.id,permissions,active:editing.active,version:editing.version,current}},"/api/admin/auth");
    else await adminRequest({action:"create-admin",input:{username,displayName:name,password,current,permissions}},"/api/admin/auth");
    setPassword("");setCurrent("");setMessage(editing?"Access updated. New permissions apply on their next request; reload their dashboard to update its menus.":`Administrator ${username} created. They can sign in with this username and add a recovery email.`);
    setEditing(null);setPermissions([]);setUsername("");setName("");await load();
  }catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}
  return <section className="admin-panel"><div className="admin-panel__heading"><h2>Your sign-in & recovery</h2><p>A username lets you sign in before adding an email. Email recovery starts after your address is verified.</p></div>
    {profile&&<div className="admin-account-summary"><p><strong>Username:</strong> {profile.username||"Sign in with your email"}</p><p><strong>Recovery email:</strong> {profile.email||"Not added yet"}</p>{!profile.emailVerified&&<p className="admin-warning">Add and verify your email below so you can reset a forgotten password.</p>}</div>}
    {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-success">{message}</p>}
    {owner&&<><h3>Administrators and access</h3><p>Only the main administrator can add people, change permissions or disable access. Existing administrators retain their previous permissions until you change them.</p>
      {profile?.team.map(member=><div className="admin-list-row" key={member.id}><span><strong>{member.username||member.displayName}</strong><small>{member.email||"Recovery email not added"}</small></span><span>{member.mainAdmin?"Main administrator":member.active?"Administrator":"Access disabled"}</span>{!member.mainAdmin&&<button type="button" disabled={busy} onClick={()=>{setEditing(member);setPermissions(member.permissions||[]);setCurrent("");setMessage("");}}>Edit access</button>}</div>)}
      <h3>{editing?`Edit access: ${editing.username||editing.displayName}`:"Add an administrator"}</h3>
      <form className="admin-form-stack" onSubmit={save}>
        {!editing&&<><label className="admin-field">Username<input autoComplete="off" pattern="[a-z][a-z0-9._-]{2,39}" minLength={3} maxLength={40} required value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/></label><label className="admin-field">Administrator name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label></>}
        <PermissionPicker value={permissions} onChange={setPermissions} disabled={busy}/>
        {editing?<label className="admin-checkbox"><input type="checkbox" checked={editing.active} onChange={e=>setEditing({...editing,active:e.target.checked})}/>Allow this administrator to sign in</label>:<label className="admin-field">Temporary password (at least 14 characters)<input type="password" autoComplete="new-password" minLength={14} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
        <label className="admin-field">Your current password<input type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
        <div className="admin-toolbar"><button className="admin-primary" disabled={busy}>{busy?"Saving…":editing?"Save administrator access":"Create administrator"}</button>{editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(null);setPermissions([]);setCurrent("");}}>Cancel editing</button>}</div>
      </form></>}
  </section>;
}
