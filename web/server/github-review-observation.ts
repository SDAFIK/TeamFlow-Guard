import { z } from "zod";
const positive=z.number().int().positive().safe();
const mapping=z.object({workspace_id:z.uuid(),pull_number:positive,task_id:z.uuid(),github_reviewer_id:positive,reviewer_id:z.uuid()}).strict();
export type ReviewMapping=z.infer<typeof mapping>;
export function reviewMappings(raw:string|undefined,workspace:string){
  const rows=z.array(mapping).max(100).parse(JSON.parse(raw||"[]")).filter(m=>m.workspace_id.toLowerCase()===workspace.toLowerCase());
  if(new Set(rows.map(m=>m.pull_number+":"+m.github_reviewer_id)).size!==rows.length)throw Error("Duplicate review mapping");
  return rows;
}
const prSchema=z.object({number:positive,state:z.enum(["open","closed"]),draft:z.boolean(),base:z.object({ref:z.string(),repo:z.object({id:positive})}),requested_reviewers:z.array(z.object({id:positive}))});
const eventSchema=z.object({event:z.string(),created_at:z.string().optional(),requested_reviewer:z.object({id:positive}).nullable().optional()});
export function reviewObservation(input:{mapping:ReviewMapping;repositoryId:number;repository:string;branch:string;pull:unknown;timeline:unknown;now:Date}){
  const {mapping:m,repositoryId,repository,branch,now}=input;
  const p=prSchema.parse(input.pull);
  if(p.number!==m.pull_number||p.base.repo.id!==repositoryId)throw Error("PR identity mismatch");
  const base={task_id:m.task_id,reviewer_id:m.reviewer_id,pull_number:m.pull_number,source_url:"https://github.com/"+repository+"/pull/"+m.pull_number,observed_at:now.toISOString(),review_requested_at:null as string|null,waiting_hours:null as number|null};
  if(p.base.ref!==branch)return {...base,status:"unrelated_branch" as const};
  if(p.state!=="open"||p.draft)return {...base,status:"inactive" as const};
  if(!p.requested_reviewers.some(r=>r.id===m.github_reviewer_id))return {...base,status:"not_requested" as const};
  // A full first page is potentially truncated. Never guess a request time.
  if(!Array.isArray(input.timeline)||input.timeline.length>=100)return {...base,status:"unknown_history" as const};
  const timeline=input.timeline.flatMap(v=>{const e=eventSchema.safeParse(v);return e.success?[e.data]:[];});
  const relevant=timeline.filter(e=>["review_requested","review_request_removed"].includes(e.event)&&e.requested_reviewer?.id===m.github_reviewer_id);
  const times=relevant.map(e=>({event:e.event,time:Date.parse(e.created_at??"")}));
  if(!times.length||times.some(e=>!Number.isFinite(e.time)||e.time>now.getTime()))return {...base,status:"unknown_history" as const};
  const latest=Math.max(...times.map(e=>e.time));
  const last=times.filter(e=>e.time===latest);
  if(last.some(e=>e.event!=="review_requested"))return {...base,status:"unknown_history" as const};
  return {...base,status:"waiting" as const,review_requested_at:new Date(latest).toISOString(),waiting_hours:(now.getTime()-latest)/3600000};
}
