import { downstream, type Edge } from "./graph";
import type { Availability, EvidenceRecord, RiskTask } from "./risk-engine";
import { experimentalRisk, type RiskFeatures } from "./tic-risk";

type Input = {tasks:(RiskTask & {due_at:string|null})[];edges:Edge[];evidence:EvidenceRecord[];members:Availability[];trackedBranch:string;isDemo:boolean;now:Date};
const hours=(ms:number)=>ms/3600000;
const observed=(e:EvidenceRecord)=>Date.parse(e.observed_at);
const validTime=(e:EvidenceRecord,now:number)=>Number.isFinite(observed(e))&&observed(e)<=now&&now-observed(e)<=72*3600000;
export function taskIntelligence(input:Input,taskId:string) {
  const task=input.tasks.find(t=>t.id===taskId);
  if(!task)return null;
  const now=input.now.getTime(), missing:string[]=[];
  const related=input.evidence.filter(e=>e.task_id===task.id&&(input.isDemo?["seed","replay"].includes(e.origin):e.origin==="github"));
  const ci=related.filter(e=>["ci_failure","ci_pass"].includes(e.kind)&&e.payload.branch===input.trackedBranch&&validTime(e,now)&&["failure","timed_out","success"].includes(String(e.payload.conclusion)));
  // Never treat missing telemetry as a healthy CI run. A single workflow is required
  // because counts across independent workflows are not comparable to the training feature.
  const streams=new Set(ci.map(e=>String(e.payload.workflow_id??(input.isDemo?"demo":"unknown"))));
  const ordered=[...ci].sort((a,b)=>observed(b)-observed(a)||Number(b.payload.run_id??0)-Number(a.payload.run_id??0)||Number(b.payload.run_attempt??0)-Number(a.payload.run_attempt??0));
  let failures:number|null=null;
  if(!ordered.length||streams.size!==1||streams.has("unknown"))missing.push("recent_unambiguous_ci_history");
  else {
    failures=0;
    const seen=new Set<string>();
    for(const e of ordered){
      const identity=String(e.payload.run_id??e.id)+":"+String(e.payload.run_attempt??1);
      if(seen.has(identity))continue;
      seen.add(identity);
      if(e.payload.conclusion==="success")break;
      failures++;
    }
  }
  // No PR-review event is not evidence that the wait is zero.
  const reviews=related.filter(e=>e.kind==="review_delay"&&e.active&&validTime(e,now)&&e.payload.state==="open"&&e.payload.is_draft===false&&Boolean(e.payload.reviewer_id));
  const reviewTimes=reviews.map(e=>Date.parse(String(e.payload.review_requested_at))).filter(t=>Number.isFinite(t)&&t<=now);
  const reviewHours=reviewTimes.length?hours(now-Math.min(...reviewTimes)):null;
  if(reviewHours===null)missing.push("observed_open_review");
  const deadline=task.due_at?Date.parse(task.due_at):NaN;
  const deadlineHours=Number.isFinite(deadline)?hours(deadline-now):null;
  if(deadlineHours===null)missing.push("task_deadline");
  const member=input.members.find(m=>m.id===task.owner_id);
  const start=Date.parse(member?.availability_start??""),end=Date.parse(member?.availability_end??"");
  const capacity=member&&Number.isFinite(member.available_hours)&&member.available_hours>=0&&start<=now&&now<end&&Number.isFinite(task.estimate_hours)&&task.estimate_hours>0
    ?Math.max(0,(task.estimate_hours-member.available_hours)/task.estimate_hours):null;
  if(capacity===null)missing.push("current_voluntary_capacity");
  const affected=downstream(input.tasks.map(t=>t.id),input.edges,task.id).filter(id=>input.tasks.find(t=>t.id===id)?.status!=="done");
  const features={ci_failures:failures,blocked:Number(task.status==="blocked"),review_hours:reviewHours,downstream_count:affected.length,deadline_hours:deadlineHours,capacity_gap:capacity};
  const provenance={ci_evidence_ids:ci.map(e=>e.id),review_evidence_ids:reviews.map(e=>e.id),affected_task_ids:affected,capacity_basis:"Task estimate versus voluntarily reported availability; not remaining effort or productivity."};
  const base={task_id:task.id,task_key:task.key,features,provenance,missing,experimental:true,fictional:input.isDemo,as_of:input.now.toISOString()};
  if(task.status==="done")return {...base,prediction:null,reason:"completed_task"};
  if(missing.length)return {...base,prediction:null,reason:"insufficient_evidence"};
  // Synthetic training does not validate real-world predictions. Keep real task
  // observations available but do not score real people/projects.
  if(!input.isDemo)return {...base,prediction:null,reason:"real_world_validation_required"};
  const prediction=experimentalRisk(features as RiskFeatures);
  return {...base,prediction,reason:prediction?"synthetic_experiment":"outside_training_domain"};
}
