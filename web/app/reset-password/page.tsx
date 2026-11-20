"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {api} from "@/lib/api";
import {Brand} from "@/components/ui";
export default function ResetPassword(){
 const router=useRouter();
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false),[result,setResult]=useState("");
 return <main id="main" tabIndex={-1} className="login-page"><div className="login-form-wrap"><form className="login-form" onSubmit={async e=>{e.preventDefault();setError("");if(password!==confirm){setError("Passwords do not match.");return;}setBusy(true);try{const response=await api<{message:string}>("/auth/reset-password",{method:"POST",body:JSON.stringify({password})});setResult(response.message);setPassword("");setConfirm("");setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Brand/><h2>Choose a new password</h2><p>Use at least 12 characters. Open this page using the newest recovery email in the browser where you requested it.</p>{error&&<div role="alert" className="error">{error}</div>}{done?<><p role="status" className="success-banner">{result}</p><Link href="/login">Return to sign in</Link></>:<><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/><button className="primary" disabled={busy}>{busy?"Updating…":"Update password"}</button><button type="button" className="text-link" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await api("/auth/logout",{method:"POST"});router.replace("/login");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Cancel and return to sign in</button></>}</form></div></main>;
}
