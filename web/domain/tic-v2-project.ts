import {validateGraph,type Edge} from "./graph";
import {risksFor,type EvidenceRecord,type Availability} from "./risk-engine";
type Task={id:string;key:string;title:string;status:string;owner_id:string;estimate_hours:number;due_at:string|null};
type Input={tasks:Task[];edges:Edge[];evidence:EvidenceRecord[];members:Availability[];trackedBranch:string;threshold:number;now:Date;role:string;planVersion:number};
export function projectIntelligence(input:Input){
 const {tasks,edges,now}=input;
 const ids=tasks.map(t=>t.id);validateGraph(ids,edges);
 const active=tasks.filter(t=>t.status!=="done");
 const known=new Set(active.map(t=>t.id));
 const links=edges.filter(e=>known.has(e.predecessor_id)&&known.has(e.successor_id));
 const byId=new Map(active.map(t=>[t.id,t]));
 const finishes=new Map<string,number>(),paths=new Map<string,string[]>();
 const ready=active.filter(t=>!links.some(e=>e.successor_id===t.id)).map(t=>t.id);
 const remaining=new Map(active.map(t=>[t.id,links.filter(e=>e.successor_id===t.id).length]));
 while(ready.length){
  const id=ready.shift()!,t=byId.get(id)!;
  const parents=links.filter(e=>e.successor_id===id).map(e=>e.predecessor_id).sort((a,b)=>(finishes.get(b)??0)-(finishes.get(a)??0)||a.localeCompare(b));
  const p=parents[0];finishes.set(id,(p?finishes.get(p)!:0)+t.estimate_hours);paths.set(id,[...(p?paths.get(p)!:[]),id]);
  for(const e of links.filter(e=>e.predecessor_id===id)){const n=remaining.get(e.successor_id)!-1;remaining.set(e.successor_id,n);if(n===0)ready.push(e.successor_id);}
 }
 const last=[...finishes.keys()].sort((a,b)=>finishes.get(b)!-finishes.get(a)!||a.localeCompare(b))[0];
 const critical=last?paths.get(last)!:[];
 const risks=risksFor(tasks,edges,input.evidence,input.members,input.threshold,now,input.trackedBranch).filter(r=>r.active&&!r.stale_evidence);
 const taskReports=active.map(t=>{
  const finish=finishes.get(t.id)!;
  const due=t.due_at?Date.parse(t.due_at):NaN;
  const slack=Number.isFinite(due)?(due-now.getTime())/3600000-finish:null;
  const blockers=links.filter(e=>e.successor_id===t.id).map(e=>e.predecessor_id);
  const evidence=risks.filter(r=>r.evidence.task_id===t.id).map(r=>({id:r.id,reason:r.reason,affected_task_ids:r.affected_task_ids}));
  return {task_id:t.id,key:t.key,title:t.title,dependency_effort_hours:finish,deadline_slack_proxy_hours:slack,unfinished_predecessors:blockers,on_critical_effort_path:critical.includes(t.id),evidence,summary:[...evidence.map(e=>e.reason),...(blockers.length?["Waiting on "+blockers.length+" unfinished prerequisite(s)."]:[]),...(slack!==null&&slack<0?["Estimated dependency effort exceeds clock time until deadline."]:[])]};
 });
 return {version:"tic-v2-graph-1",plan_version:input.planVersion,as_of:now.toISOString(),critical_effort_path:critical,critical_effort_hours:last?finishes.get(last):0,tasks:taskReports,controls:{can_request_recovery:input.role!=="viewer",can_approve:input.role==="owner"||input.role==="manager",automatic_plan_changes:false},limitations:["Uses full task estimates as a conservative effort proxy, not remaining duration.","Assumes parallel independent work and no resource/calendar constraints; not a delivery date forecast.","No synthetic-model probability is reported for real workspaces."]};
}
