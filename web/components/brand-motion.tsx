import Image from "next/image";

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
 return <section className="brand-hero" aria-label="TeamFlow Guard brand hero">
  <Image src="/teamflow-hero.webp" alt="TeamFlow Guard — See risks early. Keep humans in control." width={640} height={360} sizes="(max-width: 700px) 100vw, 1120px" priority className="brand-hero-art"/>
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
