"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, LockKeyhole, Activity, GitBranch, CheckCircle2 } from "lucide-react";
import styles from "./premium-entry.module.css";
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
  const [forgot,setForgot]=useState(false);
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
    setError("");setMessage("");
    try {
      if(forgot){const result=await api<{message:string}>("/auth/forgot-password",{method:"POST",body:JSON.stringify({email:email.trim()})});setMessage(result.message);startCooldown();return;}
      const result=await api<{message?:string}>(register?"/auth/register":"/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if(register){setMessage(result.message??'Check your email to confirm your account.');startCooldown();}else await onLogin();
    } catch (e) {
      setError((e as Error).message);if(forgot&&(e as {status?:number}).status===429)startCooldown();
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className={`login-story ${styles.story}`}>
        <Brand />
        <div className={styles.hero}>
          <span className={styles.kicker}><i aria-hidden="true"/> WORKFORCE OPERATING SYSTEM</span>
          <h1 className={styles.headline}>Build with clarity.<br/><span>Recover with confidence.</span></h1>
          <p className={styles.copy}>Connect delivery evidence, trace blocked dependencies and compare AI recovery options. Keep your team in control of every important decision.</p>
          <section className={styles.guestEntry} aria-label="Interactive competition demo"><span className={styles.kicker}>INTERACTIVE COMPETITION DEMO</span><h2>Enter sandbox instantly</h2><p>A complete product experience without creating an account. Explore a six-person team, trace a real planning problem and make your own decisions.</p><Link href="/demo" className={styles.guestButton}>Try Live Demo — No Sign-up <ArrowRight size={18}/></Link><small>No email · No password · Temporary fictional workspace</small></section>
          <div className={styles.panel} aria-label="Illustrative evidence to decision workflow">
            <div className={styles.panelHeader}><span>Delivery intelligence</span><b>Illustrative flow</b></div>
            <div className={styles.graph}>
              <div className={`${styles.node} ${styles.risk}`}><Activity size={22}/><span>Risk signal</span><small>CI failure</small></div>
              <div className={`${styles.node} ${styles.impact}`}><GitBranch size={22}/><span>Impact analysis</span><small>Dependencies</small></div>
              <div className={`${styles.node} ${styles.decision}`}><CheckCircle2 size={22}/><span>Human decision</span><small>Review proposal</small></div>
            </div>
            <div className={styles.signal} aria-hidden="true"/>
            <div className={styles.panelFooter}><span><ShieldCheck size={15}/> Evidence-backed recovery</span><span>No automatic plan changes</span></div>
          </div>
        </div>
        <small>TEAMFLOW GUARD · HUMAN-GOVERNED DELIVERY</small>
      </div>
      <div className="login-form-wrap">
        <form onSubmit={submit} className="login-form">
          <span className="login-icon">
            <ShieldCheck size={28} />
          </span>
          <h2>{forgot?'Reset your password':'Welcome to your workspace'}</h2>
          <Link href="/demo" className={styles.formGuestLink}>Try the interactive demo without signing in <ArrowRight size={15}/></Link>
          <p>{forgot?'Enter your account email. Open the newest reset link in this browser.':register?'Create your account, then create or join a workspace.':'Sign in to TeamFlow Guard.'}</p>
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
          {!forgot&&<><label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={register?"new-password":"current-password"}
            required
            minLength={register?12:1}
            maxLength={register?128:256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          </>}
          <button className="primary" type="submit" disabled={busy||(forgot&&remaining>0)}>
            {busy ? "Please wait…" : forgot?(remaining>0?`Try again in ${remaining}s`:"Send reset link"):register?'Create account':"Sign in"}
            <ArrowRight size={17} />
          </button>
          <button className="text-link" type="button" onClick={()=>{setForgot(v=>!v);setRegister(false);setPassword("");setError("");setMessage("");}}>{forgot?"Back to sign in":"Forgot password?"}</button>
          {!forgot&&<><button className="text-link" type="button" onClick={()=>{setRegister(!register);setError('');setMessage('');}}>{register?'Already have an account? Sign in':'New here? Create an account'}</button>
          <div className="confirmation-help"><p>Didn’t receive your verification email? Check spam or request a fresh link. Use the newest email.</p><button className="text-link" type="button" disabled={busy||remaining>0} onClick={()=>void resendConfirmation()}>{remaining>0?`Resend available in ${remaining}s`:"Resend confirmation email"}</button></div>
          </>}
          <div className="login-note">
            <LockKeyhole size={17} />
            <span>
              Create an account to explore your private six-person demo.
              <br />
              Real projects and fictional demo data stay separate.
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}
