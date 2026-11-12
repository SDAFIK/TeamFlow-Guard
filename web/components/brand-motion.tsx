import { ArrowRight, Github, Play } from "lucide-react";

export function GuardMark({size=36}:{size?:number}){
 return <svg className="guard-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="none">
  <path className="guard-outline" d="M32 4 56 13v17c0 15-10 24-24 30C18 54 8 45 8 30V13Z" fill="#102a3b" stroke="#50ead8" strokeWidth="3"/>
  <g stroke="#a0fff0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
   <path d="M28 25h8m-4-4 4 4-4 4M42 31v4q0 10-10 10"/>
   <rect className="guard-node guard-node-one" x="15" y="19" width="13" height="12" rx="3" fill="#102a3b"/>
   <rect className="guard-node guard-node-two" x="36" y="19" width="13" height="12" rx="3" fill="#102a3b"/>
   <rect className="guard-node guard-node-three" x="25" y="39" width="14" height="12" rx="3" fill="#102a3b"/>
   <path d="m18 25 3 3 5-6m2 17 3 3 5-6"/>
  </g>
 </svg>;
}
export function DashboardHero({demoAction,onDemo,onGithub,githubLinked}:{demoAction:string;onDemo:()=>void;onGithub:()=>void;githubLinked:boolean}){
 return <section className="brand-hero brand-hero-hd premium-hero" aria-label="TeamFlow Guard brand hero">
  <svg className="hero-signal-art" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
   <defs><radialGradient id="hero-glow"><stop stopColor="#08b6c6" stopOpacity=".45"/><stop offset="1" stopColor="#06121e" stopOpacity="0"/></radialGradient><linearGradient id="hero-wire"><stop stopColor="#1c91c9"/><stop offset=".48" stopColor="#64fff2"/><stop offset="1" stopColor="#f3b76a"/></linearGradient><linearGradient id="hero-trace"><stop stopColor="#0b405e" stopOpacity="0"/><stop offset=".5" stopColor="#21b5c2" stopOpacity=".4"/><stop offset="1" stopColor="#0b405e" stopOpacity="0"/></linearGradient></defs>
   <ellipse cx="600" cy="280" rx="410" ry="120" fill="url(#hero-glow)"/><ellipse cx="120" cy="0" rx="330" ry="210" fill="url(#hero-glow)" opacity=".5"/>
   <g fill="none" stroke="url(#hero-trace)" strokeWidth="1">{[0,1,2,3,4,5,6].map(i=><path key={i} d={`M-40 ${28+i*13} C220 ${260+i*3} 350 ${285+i*3} 600 ${270+i*2} S920 ${280-i*8} 1240 ${80-i*8}`}/>)}</g>
   <g fill="none" stroke="url(#hero-wire)" strokeWidth="1.5"><path d="M0 215 C240 215 265 286 420 257 S530 228 600 275 S850 195 1200 213"/><path d="M0 245 C260 245 350 210 600 275 S900 218 1200 245" opacity=".65"/><path d="M0 275 H1200" opacity=".25"/><path className="hero-running-signal" d="M0 215 C240 215 265 286 420 257 S530 228 600 275 S850 195 1200 213" stroke="#9afff7" strokeWidth="2.5" strokeDasharray="28 1200" strokeLinecap="round"/></g>
   <g className="hero-signal-points"><circle cx="146" cy="226" r="4" fill="#ff8992"/><circle cx="420" cy="257" r="4" fill="#ffcb73"/><circle cx="600" cy="275" r="6" fill="#67fff0"/><circle cx="1040" cy="207" r="4" fill="#67fff0"/></g>
   <g fill="#69eadd" opacity=".5">{Array.from({length:16},(_,i)=><circle key={i} cx={(i*137+33)%1200} cy={185+(i*29)%93} r={i%4===0?1.6:.8}/>)}</g>
  </svg>
  <div className="hero-brand-content"><GuardMark size={104}/><div><span className="hero-eyebrow">DELIVERY INTELLIGENCE</span><div className="hero-wordmark">TEAMFLOW <span>GUARD</span></div></div></div>
  <div className="hero-actions"><p>See risks early. Keep humans in control.</p><div className="hero-button-row"><button className="primary" onClick={onDemo}><Play size={16}/>{demoAction}<ArrowRight size={16}/></button><button className="secondary" onClick={onGithub}><Github size={18}/>{githubLinked?"GitHub connection":"Connect GitHub"}</button></div></div>
  <div className="brand-hero-light" aria-hidden="true"/>
 </section>;
}
export function WorkspaceLoader(){
 return <div className="guard-loading" role="status" aria-live="polite">
  <div className="guard-loading-orbit" aria-hidden="true"><GuardMark size={104}/></div>
  <div className="guard-loading-wordmark">TeamFlow <span>Guard</span></div>
  <p>Opening your workspace…</p>
  <div className="guard-loading-track" aria-hidden="true"><i/><i/><i/></div>
 </div>;
}
