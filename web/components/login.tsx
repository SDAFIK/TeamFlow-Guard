"use client";
import { useState } from "react";
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
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result=await api<{message?:string}>(register?"/auth/register":"/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if(register)setMessage(result.message??'Check your email to confirm your account.');else await onLogin();
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
            Good delivery starts
            <br />
            with a shared plan.
          </h1>
          <p>
            A focused workspace for your team, your tasks,
            <br className="desktop-only" /> and the decisions that move work
            forward.
          </p>
          <div className="login-chain">
            <span>
              <Check size={17} />
              Shared context
            </span>
            <ArrowRight size={16} />
            <span>
              <Users size={17} />
              Human decisions
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
