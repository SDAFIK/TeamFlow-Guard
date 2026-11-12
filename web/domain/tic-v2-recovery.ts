import {buildRecoveryOptions,githubReviewReviewer} from "./recovery-options";
import {downstream,type Edge} from "./graph";
import type {EvidenceRecord} from "./risk-engine";
type Task=Parameters<typeof buildRecoveryOptions>[0][number];
type Member=Parameters<typeof buildRecoveryOptions>[2][number];
export function simulateRecovery(tasks:Task[],edges:Edge[],members:Member[],evidence:EvidenceRecord,now=Date.now()){
 const options=buildRecoveryOptions(tasks,edges,members,evidence.task_id,evidence.kind,now,githubReviewReviewer(evidence));
 const open=tasks.filter(t=>t.status!=="done");
 const affected=downstream(tasks.map(t=>t.id),edges,evidence.task_id).filter(id=>open.some(t=>t.id===id));
 const activeCapacity=(m:Member)=>m.role!=="viewer"&&Number.isFinite(Date.parse(m.availability_start??""))&&Number.isFinite(Date.parse(m.availability_end??""))&&Date.parse(m.availability_start!)<=now&&now<Date.parse(m.availability_end!);
 const load=(rows:Task[],id:string)=>rows.reduce((n,t)=>n+(t.owner_id===id?t.estimate_hours:0)+(t.reviewer_id===id?2:0),0);
 return options.map(option=>{
  const action=option.actions[0],target=open.find(t=>t.id===action.task_id)!;
  const changed=open.map(t=>t.id===target.id?{...t,[action.field]:action.after}:t);
  const capacity=members.filter(activeCapacity).map(m=>({member_id:m.id,before_hours:load(open,m.id),after_hours:load(changed,m.id),available_hours:m.available_hours})).filter(m=>m.before_hours!==m.after_hours);
  const feasible=option.id!=="coverage"||(capacity.length>0&&capacity.some(m=>m.member_id===action.after&&m.after_hours<=m.available_hours));
  return {...option,feasible,affected_task_ids:affected,capacity,estimated_delay_reduction_hours:null,source_risk_resolved:false,requires_human_approval:true,explanation:feasible?option.effect:"Reported dated capacity does not support this change.",limitations:"Full task estimates plus two hours per assigned review; no forecast of saved time. Priority or sequencing does not resolve source evidence."};
 }).sort((a,b)=>Number(b.feasible)-Number(a.feasible)||(a.id==="coverage"?-1:b.id==="coverage"?1:a.id==="priority"?-1:b.id==="priority"?1:0));
}
