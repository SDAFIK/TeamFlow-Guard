"use client";
import {useState} from "react";
import Link from "next/link";
import {api} from "@/lib/api";
import {Brand} from "@/components/ui";
export default function ResetPassword(){
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
 return <main className="login-page"><div className="login-form-wrap"><form className="login-form" onSubmit={async e=>{e.preventDefault();setError("");if(password!==confirm){setError("Passwords do not match.");return;}setBusy(true);try{await api("/auth/reset-password",{method:"POST",body:JSON.stringify({password})});setPassword("");setConfirm("");setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Brand/><h2>Choose a new password</h2><p>Use at least 12 characters. Open this page using the newest recovery email in the browser where you requested it.</p>{error&&<div role="alert" className="error">{error}</div>}{done?<><p role="status" className="success-banner">Password updated. Sign in with your new password.</p><Link href="/login">Return to sign in</Link></>:<><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/><button className="primary" disabled={busy}>{busy?"Updating…":"Update password"}</button><Link href="/login">Request a new link or sign in</Link></>}</form></div></main>;
}
