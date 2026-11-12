import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { appReviewObservation, parseBindings, type AppConfig } from "./github-app";
import { reviewMappings } from "./github-review-observation";
const positive=z.number().int().positive().safe();
const payloadSchema=z.object({action:z.string(),installation:z.object({id:positive}),repository:z.object({id:positive,full_name:z.string()}),pull_request:z.object({number:positive})});
const prActions=new Set(["opened","closed","reopened","edited","synchronize","ready_for_review","converted_to_draft","review_requested","review_request_removed"]);
const reviewActions=new Set(["submitted","edited","dismissed"]);
export function mappedReviewEvent(config:AppConfig,raw:string|undefined,event:string,payload:unknown){
  if(event!=="pull_request"&&event!=="pull_request_review")return null;
  const parsed=payloadSchema.safeParse(payload);
  if(!parsed.success)return null;
  const p=parsed.data;
  if(!(event==="pull_request"?prActions:reviewActions).has(p.action))return null;
  const binding=parseBindings(config.bindings).find(b=>b.installation_id===p.installation.id&&b.repository_id===p.repository.id&&b.repository.toLowerCase()===p.repository.full_name.toLowerCase());
  if(!binding)return null;
  const mapping=reviewMappings(raw,binding.workspace_id).find(m=>m.pull_number===p.pull_request.number);
  return mapping?{binding,mapping}:null;
}
export const validDeliveryId=(id:string|null)=>Boolean(id&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id));
type MappedReview=NonNullable<ReturnType<typeof mappedReviewEvent>>;
export async function reconcileReview(config:AppConfig,event:MappedReview,deliveryId:string){
  if(!validDeliveryId(deliveryId))throw Error("Invalid delivery identifier");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.TEAMFLOW_GITHUB_INGEST_KEY;
  if(!url||!key)throw Error("Review ingestion not configured");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {binding:b,mapping:m}=event;
  const args={w:b.workspace_id,t:m.task_id,reviewer:m.reviewer_id};
  const context=await client.rpc("tf_github_review_context",args);
  if(context.error||typeof context.data!=="string"||!context.data)throw Error("Review mapping unavailable");
  const tracked=context.data;
  const o=await appReviewObservation(config,b.workspace_id,tracked,m);
  const {error}=await client.rpc("tf_ingest_github_review",{...args,repo:b.repository,pull_number:m.pull_number,github_reviewer_id:m.github_reviewer_id,delivery_id:deliveryId,tracked,branch:o.target_branch,review_status:o.status,requested:o.review_requested_at,observed:o.observed_at,pr_state:o.pr_state,is_draft:o.is_draft});
  if(error)throw Error("Review ingestion unavailable");
}
