import {createClient} from "@supabase/supabase-js";
import {z} from "zod";
import {parseBindings,type AppBinding,type AppConfig} from "./github-app";
import {workspaceCIMappings} from "./github-evidence";
import {reviewMappings} from "./github-review-observation";
import {databaseError,HttpError} from "./state";
const positive=z.number().int().positive().safe();
const ciSchema=z.object({workspace_id:z.uuid(),workflow_id:positive,task_id:z.uuid()}).strict();
const reviewSchema=z.object({workspace_id:z.uuid(),pull_number:positive,task_id:z.uuid(),reviewer_id:z.uuid(),github_reviewer_id:positive}).strict();
const rowsSchema=z.object({ci:z.array(ciSchema).max(100),reviews:z.array(reviewSchema).max(100)}).strict();
export const mappingInput=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("ci"),external_id:positive,task_id:z.uuid()}).strict(),
 z.object({kind:z.literal("review"),external_id:positive,task_id:z.uuid(),reviewer_id:z.uuid(),github_reviewer_id:positive}).strict(),
]);
export type MappingInput=z.infer<typeof mappingInput>;
function service(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.TEAMFLOW_GITHUB_INGEST_KEY;
 if(!url||!key)throw new HttpError(503,"GitHub evidence storage is not configured.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
function bindingArgs(b:AppBinding){return {w:b.workspace_id,repo:b.repository,installation:b.installation_id,repository:b.repository_id};}
export async function storedMappingRows(b:AppBinding){
 const {data,error}=await service().rpc("tf_github_mapping_list",bindingArgs(b));
 if(error)databaseError(error);
 const rows=rowsSchema.parse(data);
 if([...rows.ci,...rows.reviews].some(row=>row.workspace_id!==b.workspace_id))throw Error("Mapping workspace mismatch");
 return rows;
}
export async function effectiveMappings(b:AppBinding){
 const ci=workspaceCIMappings(process.env.TEAMFLOW_GITHUB_CI_MAPPINGS,b.workspace_id),reviews=reviewMappings(process.env.TEAMFLOW_GITHUB_REVIEW_MAPPINGS,b.workspace_id);
 const stored=process.env.TEAMFLOW_GITHUB_INGEST_KEY?.trim()?await storedMappingRows(b):{ci:[],reviews:[]};
 // Administrator mappings retain precedence. Never silently redirect an existing event.
 return {ci:[...ci,...stored.ci.filter(m=>!ci.some(x=>x.workflow_id===m.workflow_id))],reviews:[...reviews,...stored.reviews.filter(m=>!reviews.some(x=>x.pull_number===m.pull_number||x.task_id===m.task_id))]};
}
export function eventBinding(config:AppConfig,payload:unknown){
 if(!payload||typeof payload!=="object")return undefined;
 const p=payload as {installation?:{id?:unknown};repository?:{id?:unknown;full_name?:unknown}};
 return parseBindings(config.bindings).find(b=>b.installation_id===p.installation?.id&&b.repository_id===p.repository?.id&&typeof p.repository.full_name==="string"&&p.repository.full_name.toLowerCase()===b.repository.toLowerCase());
}
export async function createWorkspaceMapping(b:AppBinding,actor:string,input:MappingInput){
 const existing=await effectiveMappings(b);
 if(input.kind==="ci"?existing.ci.some(m=>m.workflow_id===input.external_id):existing.reviews.some(m=>m.pull_number===input.external_id||m.task_id===input.task_id))throw new HttpError(409,"This workflow, pull request or review task is already mapped.");
 const {data,error}=await service().rpc("tf_github_mapping_create",{...bindingArgs(b),actor,mapping_kind:input.kind,external:input.external_id,t:input.task_id,reviewer:input.kind==="review"?input.reviewer_id:null,github_reviewer:input.kind==="review"?input.github_reviewer_id:null});
 if(error)databaseError(error);return data;
}
