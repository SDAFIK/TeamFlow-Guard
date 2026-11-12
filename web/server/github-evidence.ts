import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { parseBindings, type AppConfig } from "./github-app";

const mappingSchema=z.array(z.object({workspace_id:z.uuid(),workflow_id:z.number().int().positive().safe(),task_id:z.uuid()}).strict()).max(100);
const runSchema=z.object({action:z.literal("completed"),installation:z.object({id:z.number().int().positive().safe()}),repository:z.object({id:z.number().int().positive().safe(),full_name:z.string()}),workflow_run:z.object({id:z.number().int().positive().safe(),workflow_id:z.number().int().positive().safe(),run_attempt:z.number().int().positive().max(2147483647),head_branch:z.string().min(1).max(255),status:z.literal("completed"),conclusion:z.enum(["success","failure","timed_out"]),updated_at:z.iso.datetime({offset:true})})});
export function mappedCI(config:AppConfig,raw:string|undefined,event:string,payload:unknown){
  if(event!=="workflow_run")return null;
  const parsed=runSchema.safeParse(payload);
  if(!parsed.success)return null;
  const p=parsed.data,r=p.workflow_run;
  const b=parseBindings(config.bindings).find(b=>b.installation_id===p.installation.id&&b.repository_id===p.repository.id&&b.repository.toLowerCase()===p.repository.full_name.toLowerCase());
  if(!b)return null;
  const mappings=mappingSchema.parse(JSON.parse(raw||"[]"));
  const matches=mappings.filter(m=>m.workspace_id.toLowerCase()===b.workspace_id&&m.workflow_id===r.workflow_id);
  if(matches.length>1)throw Error("Duplicate workflow mapping");
  if(!matches.length)return null;
  return {w:b.workspace_id,t:matches[0].task_id,repo:b.repository,workflow_id:r.workflow_id,run_id:r.id,attempt:r.run_attempt,branch:r.head_branch,conclusion:r.conclusion,observed:r.updated_at};
}
export async function ingestCI(args:NonNullable<ReturnType<typeof mappedCI>>){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.TEAMFLOW_GITHUB_INGEST_KEY;
  if(!url||!key)throw Error("CI ingestion not configured");
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {error}=await client.rpc("tf_ingest_github_ci",args);
  if(error)throw Error("CI ingestion unavailable");
}
