"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, ArrowRight, LockKeyhole, Activity, GitBranch, CheckCircle2, Menu, X, Sparkles, Compass, Users } from "lucide-react";
import styles from "./premium-entry.module.css";
import { Brand } from "./ui";
import Image from "next/image";
import { api } from "@/lib/api";
export default function Login({
  onLogin,
  onDemo,
  initialError,
  initialMessage,
}: {
  onLogin: () => Promise<void>;
  onDemo: () => Promise<void>;
  initialError: string;
  initialMessage?:string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  const [register,setRegister]=useState(false),[message,setMessage]=useState(initialMessage??"");
  const [forgot,setForgot]=useState(false);
  const [navOpen,setNavOpen]=useState(false);
  useEffect(()=>{const nodes=document.querySelectorAll("[data-entry-reveal]");if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||!("IntersectionObserver" in window))return;const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add(styles.revealed);observer.unobserve(entry.target);}}),{threshold:.12});nodes.forEach(node=>{node.classList.add(styles.reveal);observer.observe(node);});return()=>observer.disconnect();},[]);
  useEffect(()=>{if(window.location.hash)window.history.replaceState(null,"",window.location.pathname+window.location.search);},[]);
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
  async function enterDemo(){if(busy)return;setBusy(true);setError("");setMessage("");try{await onDemo();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
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
    <main className={`login-page ${styles.landing}`}>
      <header className={styles.topnav}><a href="#home" aria-label="TeamFlow Guard home"><Brand/></a><nav aria-label="Landing navigation" className={navOpen?styles.navOpen:styles.navLinks}><a href="#platform" onClick={()=>setNavOpen(false)}>Platform</a><a href="#journey" onClick={()=>setNavOpen(false)}>How it works</a><a href="#account" onClick={()=>setNavOpen(false)}>Sign in</a></nav><button type="button" className={styles.navCta} disabled={busy} onClick={()=>void enterDemo()}>Try live demo <ArrowRight size={16}/></button><button type="button" className={styles.navToggle} aria-label={navOpen?"Close menu":"Open menu"} aria-expanded={navOpen} onClick={()=>setNavOpen(v=>!v)}>{navOpen?<X/>:<Menu/>}</button></header>
      <div id="home" className={styles.entryGrid}>
      <div className={`login-story ${styles.story}`}>
        <span className={styles.brandline}>TEAMFLOW GUARD / DELIVERY INTELLIGENCE</span>
        <div className={styles.hero} id="platform">
          <div className={styles.heroBrand}><Image src="/teamflow-brand-icon.svg" alt="" width={86} height={105} unoptimized priority/><div className={styles.heroBrandText}><strong>TeamFlow <span>Guard</span></strong><small>Human-governed delivery intelligence</small></div></div>
          <span className={styles.kicker}><i aria-hidden="true"/> WORKFORCE OPERATING SYSTEM</span>
          <h1 className={styles.headline}>Build with clarity.<br/><span>Recover with confidence.</span></h1>
          <p className={styles.copy}>Connect delivery evidence, trace blocked dependencies and compare AI recovery options. Keep your team in control of every important decision.</p>
          <section className={styles.guestEntry} aria-label="Interactive competition demo"><span className={styles.kicker}>INTERACTIVE COMPETITION DEMO</span><h2>Enter sandbox instantly</h2><p>A complete product experience without registration. Enter the actual six-person TeamFlow Guard workspace with TIC Intelligence, Gemini recovery, connected tasks and human decisions.</p><button type="button" disabled={busy} onClick={()=>void enterDemo()} className={styles.guestButton}>{busy?"Opening workspace…":"Enter Live Demo — No Sign-up"} <ArrowRight size={18}/></button><small>No email · No password · Private temporary demo session</small></section>
          <div className={styles.panel} aria-label="Illustrative evidence to decision workflow"><div className={styles.scanner} aria-hidden="true"><div className={styles.orbit}/><div className={styles.orbitTwo}/><div className={styles.core}><ShieldCheck size={36}/></div><i className={styles.scanBeam}/></div>
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
      <div className="login-form-wrap" id="account">
        <form onSubmit={submit} className="login-form">
          <span className="login-icon">
            <ShieldCheck size={28} />
          </span>
          <h2>{forgot?'Reset your password':'Welcome to your workspace'}</h2>
          <button type="button" disabled={busy} onClick={()=>void enterDemo()} className={styles.formGuestLink}>Enter the real demo workspace <ArrowRight size={15}/></button>
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
      </div>
      <section id="journey" className={styles.journey} data-entry-reveal><span className={styles.kicker}>THE PRODUCT JOURNEY</span><h2>From a failing build to a confident decision.</h2><p>One connected workspace. Evidence first, intelligence second, human approval always.</p><div className={styles.journeyCards}>{[{icon:Activity,title:"Detect the signal",copy:"Connect a failing CI check, delayed review or capacity constraint to a task."},{icon:GitBranch,title:"Trace the impact",copy:"TIC Intelligence explains dependencies and unfinished downstream effort."},{icon:Sparkles,title:"Compare recovery",copy:"Gemini and deterministic rules propose feasible options with tradeoffs."},{icon:ShieldCheck,title:"Decide & verify",copy:"Approve a versioned plan change and read the audit trail. No automatic decisions."}].map(({icon:Icon,title,copy})=><article key={title}><Icon size={25}/><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className={styles.updates} data-entry-reveal><div><span className={styles.kicker}>EXPLORE THE PRODUCT</span><h2>Built for real software teams.</h2></div><div className={styles.updateRail}><article><Compass size={21}/><h3>Instant private demo</h3><p>Six members, ten tasks and a realistic delivery challenge.</p></article><article><Sparkles size={21}/><h3>TIC + Gemini</h3><p>Evidence-backed analysis, model laboratory and recovery options.</p></article><article><Users size={21}/><h3>Human-led decisions</h3><p>Team permissions, approval receipts and a readable audit log.</p></article></div><button className={styles.guestButton} disabled={busy} onClick={()=>void enterDemo()}>Enter the real workspace <ArrowRight size={17}/></button></section>
      <footer className={styles.footer}><Brand/><span>Human-governed delivery intelligence · No automatic plan changes</span><a href="#home">Back to top ↑</a></footer>
    </main>
  );
}
