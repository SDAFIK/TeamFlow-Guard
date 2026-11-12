"use client";
import {useState} from "react";
import {ArrowRight, ChartNoAxesColumn, GitBranch, Search, ShieldCheck, TriangleAlert, UserPlus, Users} from "lucide-react";
import type {Overview,Risk} from "@/lib/api";
import {Modal} from "./ui";

const riskColors=["#fb858e","#f8c478","#54e2ce","#8caeff","#c0a1ff"];
const riskLabels:Record<string,string>={ci_failure:"CI failures",dependency:"Dependencies",review_delay:"Review delays",capacity:"Capacity",ci_pass:"CI checks"};
const riskLabel=(kind:string)=>riskLabels[kind]??kind.replaceAll("_"," ");
export function DashboardTeam({data,onManage,onInvite}:{data:Overview;onManage:()=>void;onInvite:()=>void}){
 return <section className="panel premium-team-panel" aria-label="Team collaboration">
  <div className="panel-head"><div><span className="section-kicker">PEOPLE</span><h2>Team & collaboration</h2></div><button className="text-link" onClick={onManage}>Manage <ArrowRight size={14}/></button></div>
  <div className="premium-team-list">{data.members.slice(0,5).map((m,i)=><div className="premium-team-member" key={m.id}><span className={`avatar color-${i%4}`}>{m.name[0]}</span><div><strong>{m.name}</strong><small>{m.specialty||m.role}</small></div><span className="member-hours">{m.available_hours}h</span></div>)}
  {!data.members.length&&<p>No teammates have joined yet.</p>}</div>
  {data.members.length>5&&<button className="text-link premium-more" onClick={onManage}>View all {data.members.length} teammates</button>}
  <button className="premium-invite" onClick={onInvite}><UserPlus size={20}/><span><strong>Invite teammates</strong><small>Connect by email</small></span><ArrowRight size={17}/></button>
  <p className="premium-team-note">Hours are shared availability, not presence tracking.</p>
 </section>;
}
export function DashboardAnalytics({data,risks}:{data:Overview;risks:Risk[]}){
 const workload=data.members.map(m=>({id:m.id,name:m.name,count:data.tasks.filter(t=>t.owner_id===m.id&&t.status!=="done").length}));
 const highest=Math.max(1,...workload.map(m=>m.count));
 const groups=Object.entries(risks.reduce<Record<string,number>>((counts,r)=>{counts[r.evidence.kind]=(counts[r.evidence.kind]??0)+1;return counts;},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
 let position=0;
 const gradient=groups.map(([,count],i)=>{const start=position;position+=count/risks.length*100;return riskColors[i%riskColors.length]+" "+start+"% "+position+"%";}).join(",");
 return <>
 <section className="panel premium-analytics" aria-label="Workload by teammate"><div className="panel-head"><div><span className="section-kicker"><Users size={14}/> ASSIGNED WORK</span><h2>Workload by teammate</h2></div></div><p className="analytics-caption">Unfinished tasks per person</p>
 <div className="workload-bars">{workload.slice(0,6).map(m=><div className="workload-row" key={m.id}><span>{m.name}</span><div className="workload-track"><i style={{width:(m.count/highest*100)+"%"}}/></div><strong>{m.count}</strong></div>)}</div>
 {workload.length>6&&<p className="analytics-caption">Showing 6 of {workload.length} teammates.</p>}{!workload.length&&<p className="analytics-caption">No assigned team members yet.</p>}
 </section>
 <section className="panel premium-analytics" aria-label="Risk category breakdown"><div className="panel-head"><div><span className="section-kicker"><TriangleAlert size={14}/> ACTIVE EVIDENCE</span><h2>Risk by category</h2></div></div><div className="risk-donut-layout"><div className="risk-donut" role="img" aria-label={risks.length+" active risks"} style={{background:risks.length?"conic-gradient("+gradient+")":"#233b4c"}}><div><strong>{risks.length}</strong><small>Active risks</small></div></div><div className="risk-donut-legend">{groups.map(([kind,count],i)=><div key={kind}><i style={{background:riskColors[i%riskColors.length]}}/><span>{riskLabel(kind)}</span><strong>{count}</strong></div>)}{!risks.length&&<p><ShieldCheck size={18}/> No active risks</p>}</div></div></section>
 </>;
}
export function WorkspaceSearch({data,risks,onTask,onRisk,onPerson,onDependency}:{data:Overview;risks:Risk[];onTask:(id:string)=>void;onRisk:(id:string)=>void;onPerson:()=>void;onDependency:(id:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const search=query.trim().toLowerCase();
 const tasks=data.tasks.filter(t=>(t.key+" "+t.title).toLowerCase().includes(search)).slice(0,6);
 const people=data.members.filter(m=>(m.name+" "+m.specialty).toLowerCase().includes(search)).slice(0,4);
 const signals=risks.filter(r=>r.active&&(r.evidence.title+" "+r.reason).toLowerCase().includes(search)).slice(0,4);
 function choose(action:()=>void){setOpen(false);action();}
 return <><button className="premium-search" aria-label="Search workspace" onClick={()=>{setQuery("");setOpen(true);}}><Search size={18}/><span>Search tasks, people or risks…</span></button>
 {open&&<Modal title="Search workspace" onClose={()=>setOpen(false)} wide><label className="premium-search-input"><Search size={19}/><input type="search" aria-label="Search tasks, teammates and risks" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a task, teammate or risk"/></label><div className="premium-search-results">
 {tasks.length>0&&<><h3>Tasks</h3>{tasks.map(t=><div className="search-result-row" key={t.id}><button onClick={()=>choose(()=>onTask(t.id))}><ChartNoAxesColumn size={16}/><span>{t.key} · {t.title}</span></button><button aria-label={"View dependencies for "+t.key} onClick={()=>choose(()=>onDependency(t.id))}><GitBranch size={16}/></button></div>)}</>}
 {people.length>0&&<><h3>Teammates</h3>{people.map(m=><button className="search-result-person" key={m.id} onClick={()=>choose(onPerson)}><Users size={16}/>{m.name}<ArrowRight size={15}/></button>)}</>}
 {signals.length>0&&<><h3>Risk signals</h3>{signals.map(r=><button className="search-result-person" key={r.id} onClick={()=>choose(()=>onRisk(r.id))}><TriangleAlert size={16}/>{r.evidence.title}<ArrowRight size={15}/></button>)}</>}
 {!tasks.length&&!people.length&&!signals.length&&<p>No matching saved workspace items.</p>}</div></Modal>}</>;
}
