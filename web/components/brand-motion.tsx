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
export function DashboardHero(){
 return <section className="brand-hero brand-hero-hd" aria-label="TeamFlow Guard brand hero">
  <svg className="hero-signal-art" viewBox="0 0 1200 430" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><radialGradient id="hero-glow"><stop stopColor="#0b879a" stopOpacity=".48"/><stop offset="1" stopColor="#06121e" stopOpacity="0"/></radialGradient><linearGradient id="hero-wire"><stop stopColor="#3a9bcb"/><stop offset=".5" stopColor="#5af8ed"/><stop offset="1" stopColor="#f4c76c"/></linearGradient></defs>
    <ellipse cx="160" cy="70" rx="440" ry="280" fill="url(#hero-glow)"/><ellipse cx="960" cy="410" rx="360" ry="160" fill="url(#hero-glow)"/>
    <g fill="none" stroke="url(#hero-wire)" strokeWidth="1.7" opacity=".8"><path d="M0 340 C260 340 390 407 600 385S900 315 1200 328"/><path d="M0 355 C280 355 430 335 600 385S940 360 1200 350"/><path d="M0 385 H1200" strokeOpacity=".35"/></g>
    <g className="hero-signal-points"><circle cx="160" cy="346" r="5" fill="#f58285"/><circle cx="390" cy="352" r="5" fill="#f7c76d"/><circle cx="600" cy="385" r="7" fill="#61ffec"/><circle cx="990" cy="336" r="5" fill="#f7c76d"/><circle cx="1120" cy="333" r="5" fill="#61ffec"/></g>
  </svg>
  <div className="hero-brand-content"><GuardMark size={132}/><div><span className="hero-eyebrow">DELIVERY INTELLIGENCE</span><div className="hero-wordmark">TEAMFLOW <span>GUARD</span></div><p>See risks early. Keep humans in control.</p></div></div>
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
