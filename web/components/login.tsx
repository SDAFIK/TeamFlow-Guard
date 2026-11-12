"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowRight, Users, LockKeyhole, Check } from "lucide-react";
import { Brand } from "./ui";
import { api } from "@/lib/api";
export default function Login({
  onLogin,
  initialError,
}: {
  onLogin: () => Promise<void>;
  initialError: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  const [register,setRegister]=useState(false),[message,setMessage]=useState('');
  const [resendUntil,setResendUntil]=useState(0),[clock,setClock]=useState(0);
  const remaining=Math.max(0,Math.ceil((resendUntil-clock)/1000));
  useEffect(()=>{if(!resendUntil)return;const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer);},[resendUntil]);
  function startCooldown(){const now=Date.now();setClock(now);setResendUntil(now+60_000);}
  async function resendConfirmation(){
    if(busy||remaining>0)return;
    if(!email.trim()){setError("Enter the email address you registered with first.");return;}
    setBusy(true);setError("");setMessage("");
    try {
      const result=await api<{message:string}>("/auth/resend-confirmation",{method:"POST",body:JSON.stringify({email:email.trim()})});
      setMessage(result.message);
      startCooldown();
    }catch(e){setError((e as Error).message);if((e as {status?:number}).status===429)startCooldown();}
    finally{setBusy(false);}
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result=await api<{message?:string}>(register?"/auth/register":"/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if(register){setMessage(result.message??'Check your email to confirm your account.');startCooldown();}else await onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">LESS GUESSWORK. MORE CLARITY.</span>
          <h1>
            Detect delivery risks.
            <br />
            Recover with confidence.
          </h1>
          <p>
            Understand which tasks are affected, compare recovery options,
            and approve a plan your team can act on. Evidence informs. Your team decides.
          </p>
          <div className="login-chain">
            <span>
              <Check size={17} />
              Evidence & impact
            </span>
            <ArrowRight size={16} />
            <span>
              <Users size={17} />
              Human-approved recovery
            </span>
          </div>
        </div>
        <small>TEAMFLOW GUARD · HUMAN-APPROVED DELIVERY</small>
      </div>
      <div className="login-form-wrap">
        <form onSubmit={submit} className="login-form">
          <span className="login-icon">
            <ShieldCheck size={28} />
          </span>
          <h2>Welcome to your workspace</h2>
          <p>{register?'Create your account, then create or join a workspace.':'Sign in to TeamFlow Guard.'}</p>
          {message&&<p role="status" className="success-banner">{message}</p>}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={register?12:1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : register?'Create account':"Sign in"}
            <ArrowRight size={17} />
          </button>
          <button className="text-link" type="button" onClick={()=>{setRegister(!register);setError('');setMessage('');}}>{register?'Already have an account? Sign in':'New here? Create an account'}</button>
          <div className="confirmation-help"><p>Didn’t receive your verification email? Check spam or request a fresh link. Use the newest email.</p><button className="text-link" type="button" disabled={busy||remaining>0} onClick={()=>void resendConfirmation()}>{remaining>0?`Resend available in ${remaining}s`:"Resend confirmation email"}</button></div>
          <div className="login-note">
            <LockKeyhole size={17} />
            <span>
              Demo accounts are provisioned by the workspace owner.
              <br />
              Use the sign-in details provided for your workspace.
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}
