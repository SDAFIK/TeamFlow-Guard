"use client";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, ChevronRight, GitBranch, ShieldCheck, Sparkles, X } from "lucide-react";
import styles from "./product-guide.module.css";

export type GuideDestination = "overview" | "intelligence" | "risks" | "dependencies" | "decisions" | "audit";

const steps = [
  { view: "overview", label: "1 · Understand", title: "Spot the signals", description: "See a failing build, delayed review and team capacity pressure.", icon: Activity, tone: "cyan" },
  { view: "intelligence", label: "2 · TIC Intelligence", title: "Understand the risk", description: "Explore evidence, linked work and unfinished downstream effort.", icon: BrainCircuit, tone: "violet" },
  { view: "risks", label: "3 · Gemini & recovery", title: "Compare recovery", description: "Review validated rule-based options and Gemini assistance.", icon: Sparkles, tone: "pink" },
  { view: "dependencies", label: "4 · Trace impact", title: "Follow dependencies", description: "Discover which connected tasks need attention next.", icon: GitBranch, tone: "blue" },
  { view: "decisions", label: "5 · Decide", title: "Stay in control", description: "Approve or reject a proposed change before it affects the plan.", icon: ShieldCheck, tone: "mint" },
  { view: "audit", label: "6 · Verify", title: "Review the outcome", description: "See who decided what, before-and-after changes and plan versions.", icon: CheckCircle2, tone: "gold" },
] as const;

const pageHints: Record<string, string> = {
  overview: "Start with the delivery summary. Select any risk to inspect its evidence.",
  intelligence: "TIC highlights dependencies, risk signals and estimated unfinished effort. Synthetic scores are for exploration.",
  risks: "Select a risk, compare available recovery actions, and request Gemini analysis when available.",
  dependencies: "Focus a task to inspect prerequisites and the downstream work it affects.",
  decisions: "Inspect each proposed change and approve or reject it. A failed CI check needs new passing evidence.",
  audit: "Read the saved human decision, its before-and-after changes and the updated plan version.",
  tasks: "Review the shared task plan, statuses and owners. Changes are saved to your private workspace.",
  team: "Compare available team hours with estimated workload, without employee performance scoring.",
  settings: "Manage your workspace and optional integrations.",
};

export function ProductGuide({current, guest, onNavigate, onClose}: {
  current: string;
  guest: boolean;
  onNavigate: (view: GuideDestination) => void;
  onClose: () => void;
}) {
  const activeIndex = steps.findIndex(step => step.view === current);
  return (
    <section className={styles.guide} aria-label="Interactive product guide">
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}><span className={styles.dot}/> INTERACTIVE WORKSPACE GUIDE</span>
          <h2>Explore the problem. Understand the solution.</h2>
          <p>Follow how TeamFlow Guard turns delivery signals into informed, human-approved decisions. Start anywhere, or explore freely.</p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Hide product guide"><X size={16}/> <span>Hide guide</span></button>
      </header>
      <div className={styles.steps} aria-label="Product walkthrough steps">
        {steps.map((step,index)=>{
          const Icon=step.icon;
          const active=step.view===current;
          return <button
            key={step.view}
            type="button"
            aria-label={step.label}
            aria-current={active?"step":undefined}
            onClick={()=>onNavigate(step.view)}
            className={[styles.step, styles[step.tone], active?styles.active:""].filter(Boolean).join(" ")}
            style={{animationDelay:`${index*65}ms`}}
          >
            <span className={styles.stepTop}><span className={styles.icon}><Icon size={19}/></span><span className={styles.number}>0{index+1}</span></span>
            <strong>{step.title}</strong>
            <span className={styles.description}>{step.description}</span>
            <span className={styles.stepBottom}><span>{active?"Viewing now":"Explore"}</span><ArrowRight size={15}/></span>
          </button>;
        })}
      </div>
      <footer className={styles.footer}>
        <div className={styles.focus}>
          <span className={styles.focusIcon}><ChevronRight size={17}/></span>
          <div><strong>{activeIndex>=0?`Step ${activeIndex+1} of 6 · ${steps[activeIndex].title}`:"Explore at your pace"}</strong><span>{pageHints[current]??"Choose any area to continue learning about the product."}</span></div>
        </div>
        {guest&&<p className={styles.guestInfo}>Private sample workspace · Guest Gemini use is limited; rule-based recovery remains available.</p>}
      </footer>
    </section>
  );
}
