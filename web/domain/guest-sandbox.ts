import type { Task, Person, Graph } from "@/lib/api";
import { downstream, validateGraph, type Edge } from "./graph";
import { risksFor, type EvidenceRecord } from "./risk-engine";
import { simulateRecovery } from "./tic-v2-recovery";
import type { ProposedAction } from "./proposal";
export type Scenario="release"|"capacity"|"review"|"healthy";
export type GuestMember=Person&{role:string;specialty:string;available_hours:number;availability_start:string;availability_end:string};
export type GuestProposal={id:string;title:string;effect:string;tradeoff:string;actions:ProposedAction[];version:number;status:"pending"|"approved"|"rejected"|"stale";riskId?:string};
export type GuestState={scenario:Scenario;tasks:Task[];members:GuestMember[];edges:Edge[];evidence:EvidenceRecord[];proposals:GuestProposal[];audit:{id:string;summary:string;version:number}[];version:number;sequence:number;clock:string;message:string};
const clock="2026-11-01T12:00:00.000Z";
const uid=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const member=(n:number,name:string,specialty:string,hours:number):GuestMember=>({id:uid(n),name,email:"",role:n===1?"lead":"member",specialty,available_hours:hours,availability_start:"2026-10-31T12:00:00.000Z",availability_end:"2026-11-08T12:00:00.000Z"});
const task=(n:number,key:string,title:string,owner:number,hours:number,status:Task["status"],priority="normal"):Task=>({id:uid(n),key,title,description:"Fictional checkout release task",owner_id:uid(owner),reviewer_id:null,estimate_hours:hours,status,priority,position:n-10,version:1});
const edge=(a:number,b:number):Edge=>({predecessor_id:uid(a),successor_id:uid(b)});
export function seedGuest(scenario:Scenario="release"):GuestState{
 const members=[member(1,"Alex Morgan","Engineering lead",32),member(2,"Maya Chen","Frontend",24),member(3,"Ryan Patel","Backend",scenario==="capacity"||scenario==="release"?8:32),member(4,"Sara Ahmed","QA",36),member(5,"Daniel Kim","DevOps",32),member(6,"Nora Wilson","Design",28)];
 const tasks=[task(10,"AUTH-142","Authentication API",3,16,scenario==="release"?"blocked":"in_progress","high"),task(11,"LOGIN-210","Login experience",2,12,"in_progress","high"),task(12,"CHK-318","Checkout UI",2,12,"todo","high"),task(13,"PAY-104","Payment API",3,12,"in_progress"),task(14,"QA-105","Checkout acceptance",4,8,"todo"),task(15,"REL-106","Release candidate",5,8,"todo","high"),task(16,"UX-107","Checkout design review",6,8,"done"),task(17,"CI-108","Repair CI pipeline",5,12,"in_progress"),task(18,"QA-109","Payment regression",4,8,"todo"),task(19,"PLAN-110","Release risk review",1,6,"todo")];
 const edges=[edge(10,11),edge(11,12),edge(12,14),edge(13,18),edge(18,14),edge(14,15),edge(17,15),edge(16,12),edge(19,15)];
 const evidence:EvidenceRecord[]=[];
 const add=(n:number,kind:string,title:string,detail:string,payload:Record<string,unknown>={})=>evidence.push({id:uid(n),task_id:uid(10),kind,title,detail,origin:"guest-fixture",active:true,observed_at:clock,payload});
 if(scenario==="release"){add(30,"ci_failure","Authentication CI failed","A fictional main-branch check failed.",{branch:"main",tracked_branch:"main",conclusion:"failure"});add(31,"dependency","Authentication API blocked","Login, checkout, QA and release depend on this task.");}
 if(scenario==="release"||scenario==="review")add(32,"review_delay","Authentication PR awaiting review","Fictional open review waiting 48 hours.",{state:"open",is_draft:false,reviewer_id:uid(4),review_requested_at:"2026-10-30T12:00:00.000Z"});
 if(scenario==="release"||scenario==="capacity")add(33,"capacity","Backend availability constraint","Eight reported hours versus sixteen estimated hours.");
 return {scenario,tasks,members,edges,evidence,proposals:[],audit:[{id:uid(90),summary:"Fictional workspace initialized",version:1}],version:1,sequence:100,clock,message:"Your guest sandbox is ready."};
}
export const guestRisks=(s:GuestState)=>risksFor(s.tasks,s.edges,s.evidence,s.members,24,new Date(s.clock),"main");
export function guestGraph(s:GuestState,selected:string|null):Graph{
 const ids=s.tasks.map(t=>t.id),id=selected&&ids.includes(selected)?selected:null;
 return {nodes:s.tasks,edges:s.edges,plan_version:s.version,selected_task_id:id,upstream_ids:id?downstream(ids,s.edges,id,true):[],downstream_ids:id?downstream(ids,s.edges,id):[]};
}
export function guestOptions(s:GuestState,riskId:string){
 const risk=guestRisks(s).find(r=>r.id===riskId&&r.active);
 return risk?simulateRecovery(s.tasks,s.edges,s.members,risk.evidence,Date.parse(s.clock)).filter(o=>o.feasible):[];
}
export type GuestAction=
 |{type:"reset";scenario:Scenario}
 |{type:"propose";riskId:string;optionId:string}
 |{type:"link";source:string;target:string}
 |{type:"decide";id:string;decision:"approve"|"reject"}
 |{type:"status";id:string;status:Task["status"]}
 |{type:"hours";id:string;hours:number}
 |{type:"event";id:string;kind:"ci_failure"|"ci_pass"|"review_delay"|"review_resolved"|"dependency"|"capacity"}
 |{type:"task";title:string;owner:string;hours:number};
const error=(s:GuestState,message:string):GuestState=>({...s,message});
function record(s:GuestState,summary:string,change:Partial<GuestState>={},version=s.version):GuestState{
 return {...s,...change,version,sequence:s.sequence+1,message:summary,audit:[{id:uid(s.sequence),summary,version},...s.audit].slice(0,80)};
}
export function guestReducer(s:GuestState,a:GuestAction):GuestState{
 if(a.type==="reset")return seedGuest(a.scenario);
 if(a.type==="propose"){
  if(s.proposals.filter(p=>p.status==="pending").length>=12)return error(s,"Review existing pending proposals first.");
  const option=guestOptions(s,a.riskId).find(o=>o.id===a.optionId);
  if(!option)return error(s,"That option is no longer feasible. Recalculate recovery options.");
  if(s.proposals.some(p=>p.status==="pending"&&p.riskId===a.riskId&&p.actions[0]?.field===option.actions[0]?.field&&p.version===s.version))return error(s,"This option is already pending.");
  const p:GuestProposal={id:uid(s.sequence),title:option.title,effect:option.effect,tradeoff:option.tradeoff,actions:option.actions,version:s.version,status:"pending",riskId:a.riskId};
  return record(s,"Proposal created. The plan has not changed.",{proposals:[p,...s.proposals].slice(0,60)});
 }
 if(a.type==="link"){
  try{
   if(s.proposals.filter(p=>p.status==="pending").length>=12)throw Error("Review pending proposals first.");
   if(s.tasks.find(t=>t.id===a.target)?.status==="done")throw Error("Completed tasks cannot receive new dependencies.");
   validateGraph(s.tasks.map(t=>t.id),[...s.edges,{predecessor_id:a.source,successor_id:a.target}]);
   const p:GuestProposal={id:uid(s.sequence),title:"Connect "+s.tasks.find(t=>t.id===a.source)!.key+" → "+s.tasks.find(t=>t.id===a.target)!.key,effect:"Add a prerequisite to the plan.",tradeoff:"The dependent task must wait for its prerequisite.",actions:[{task_id:a.target,field:"dependency",before:null,after:a.source}],version:s.version,status:"pending"};
   return record(s,"Dependency proposal created. Approval is required.",{proposals:[p,...s.proposals].slice(0,60)});
  }catch(e){return error(s,(e as Error).message);}
 }
 if(a.type==="decide"){
  const p=s.proposals.find(p=>p.id===a.id);
  if(!p||p.status!=="pending")return error(s,"This proposal has already been reviewed.");
  const update=(status:GuestProposal["status"])=>s.proposals.map(x=>x.id===p.id?{...x,status}:x);
  if(a.decision==="reject")return record(s,"Proposal rejected. The plan is unchanged.",{proposals:update("rejected")});
  if(p.version!==s.version||p.riskId&&!guestRisks(s).some(r=>r.id===p.riskId&&r.active))return record(s,"Proposal is stale. Compare fresh recovery options.",{proposals:update("stale")});
  let tasks=s.tasks,edges=s.edges;
  try{for(const act of p.actions){
   const t=tasks.find(t=>t.id===act.task_id);if(!t)throw Error("Task unavailable.");
   if(act.field==="dependency"){edges=[...edges,{predecessor_id:String(act.after),successor_id:t.id}];validateGraph(tasks.map(t=>t.id),edges);}
   else {if(t[act.field]!==act.before)throw Error("Plan changed.");tasks=tasks.map(x=>x.id===t.id?{...x,[act.field]:act.after,version:x.version+1}:x);}
  }}catch(e){return record(s,(e as Error).message,{proposals:update("stale")});}
  return record(s,"Approved: "+p.title+". The plan changed; source evidence is tracked separately.",{tasks,edges,proposals:update("approved")},s.version+1);
 }
 if(a.type==="status"){
  if(!s.tasks.some(t=>t.id===a.id))return error(s,"Task unavailable.");
  if(a.status==="done"&&s.edges.some(e=>e.successor_id===a.id&&s.tasks.find(t=>t.id===e.predecessor_id)?.status!=="done"))return error(s,"Finish prerequisite tasks first.");
  if(a.status==="done"&&guestRisks(s).some(r=>r.active&&r.evidence.task_id===a.id&&r.evidence.kind==="ci_failure"))return error(s,"Replay a passing CI check before completing this task.");
  return record(s,"Task status updated.",{tasks:s.tasks.map(t=>t.id===a.id?{...t,status:a.status,version:t.version+1}:t)},s.version+1);
 }
 if(a.type==="hours"){
  if(!Number.isFinite(a.hours)||a.hours<0||a.hours>80||!s.members.some(m=>m.id===a.id))return error(s,"Availability must be 0–80 hours.");
  return record(s,"Reported availability updated. Risks recalculated.",{members:s.members.map(m=>m.id===a.id?{...m,available_hours:a.hours}:m)},s.version+1);
 }
 if(a.type==="task"){
  if(!a.title.trim()||a.title.length>100||!Number.isFinite(a.hours)||a.hours<1||a.hours>80||!s.members.some(m=>m.id===a.owner)||s.tasks.length>=25)return error(s,"Use a title, valid owner and 1–80 hours (maximum 25 tasks).");
  const t:Task={...task(s.sequence,"NEW-"+s.sequence,a.title.trim(),1,a.hours,"todo"),owner_id:a.owner,position:s.tasks.length};
  return record(s,"Task added to your fictional plan.",{tasks:[...s.tasks,t]},s.version+1);
 }
 if(a.type==="event"){
  if(!s.tasks.some(t=>t.id===a.id))return error(s,"Task unavailable.");
  const kind=a.kind==="ci_pass"?"ci_failure":a.kind==="review_resolved"?"review_delay":a.kind;
  const evidence=s.evidence.filter(e=>!(e.task_id===a.id&&e.kind===kind));
  if(a.kind!=="ci_pass"&&a.kind!=="review_resolved"){
   const t=s.tasks.find(t=>t.id===a.id)!;
   const payload=a.kind==="ci_failure"?{branch:"main",tracked_branch:"main",conclusion:"failure"}:a.kind==="review_delay"?{state:"open",is_draft:false,reviewer_id:s.members[3].id,review_requested_at:"2026-10-30T12:00:00.000Z"}:{};
   evidence.push({id:uid(s.sequence),task_id:a.id,kind,title:t.key+" · "+a.kind.replaceAll("_"," "),detail:"Simulated guest event. No external service called.",origin:"guest-fixture",active:true,observed_at:s.clock,payload});
  }
  const tasks=a.kind==="dependency"?s.tasks.map(t=>t.id===a.id?{...t,status:"blocked" as const,version:t.version+1}:t):s.tasks;
  return record(s,a.kind==="ci_pass"?"Passing CI replayed. CI failure cleared; other risks may remain.":a.kind==="review_resolved"?"Review resolved. Other risks may remain.":"Simulated evidence updated. Risks recalculated.",{evidence,tasks},s.version+1);
 }
 return s;
}
