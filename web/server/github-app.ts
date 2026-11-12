import { createSign, createHmac, timingSafeEqual } from "node:crypto";
import { reviewObservation, reviewStateFingerprint, type ReviewMapping } from "./github-review-observation";
import { repositorySlug, type PublicRun } from "./github-public";
export type AppBinding = {workspace_id:string;installation_id:number;repository_id:number;repository:string};
export type AppConfig = {appId?:string;privateKey?:string;bindings?:string;webhookSecret?:string};
type Pull = {number:number;title:string;draft:boolean;html_url:string;updated_at:string};
type Delivery = {id:string;event:string;action:string|null;status_code:number;delivered_at:string};
const positive = (x:unknown):x is number => typeof x==="number" && Number.isSafeInteger(x) && x>0;
const deliveryId = (x:unknown):string|null => positive(x)?String(x):typeof x==="string"&&/^[1-9]\d{0,19}$/.test(x)?x:null;
const obj = (x:unknown):Record<string,unknown> => x!==null && typeof x==="object" && !Array.isArray(x) ? x as Record<string,unknown> : {};
const txt = (x:unknown,n=200) => typeof x==="string"?x.slice(0,n):"";
export function githubAppConfig():AppConfig {
  return {appId:process.env.GITHUB_APP_ID,privateKey:process.env.GITHUB_APP_PRIVATE_KEY,bindings:process.env.TEAMFLOW_GITHUB_APP_BINDINGS,webhookSecret:process.env.GITHUB_APP_WEBHOOK_SECRET};
}
export function parseBindings(raw?:string):AppBinding[] {
  if(!raw?.trim()) return [];
  try {
    const rows:unknown=JSON.parse(raw);
    if(!Array.isArray(rows)||rows.length>100) throw Error();
    const ws=new Set<string>(), repos=new Set<number>();
    return rows.map(v=>{
      const r=obj(v);
      if(typeof r.workspace_id!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(r.workspace_id)||!positive(r.installation_id)||!positive(r.repository_id)||typeof r.repository!=="string"||repositorySlug(r.repository)!==r.repository) throw Error();
      const workspace_id=r.workspace_id.toLowerCase();
      if(ws.has(workspace_id)||repos.has(r.repository_id)) throw Error();
      ws.add(workspace_id);repos.add(r.repository_id);
      return {workspace_id,installation_id:r.installation_id,repository_id:r.repository_id,repository:r.repository};
    });
  } catch {throw Error("Invalid GitHub App workspace configuration.");}
}
export function bindingForWorkspace(c:AppConfig,w:string){return parseBindings(c.bindings).find(r=>r.workspace_id===w.toLowerCase());}
export function githubAppReady(c:AppConfig){return /^\d{1,20}$/.test(c.appId??"")&&Boolean(c.privateKey?.trim());}
function jwt(c:AppConfig){
  if(!githubAppReady(c))throw Error("GitHub App not configured.");
  const now=Math.floor(Date.now()/1000);
  const enc=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
  const body=enc({alg:"RS256",typ:"JWT"})+"."+enc({iat:now-60,exp:now+480,iss:c.appId});
  const sign=createSign("RSA-SHA256");sign.update(body);
  return body+"."+sign.sign(c.privateKey!.replace(/\\n/g,"\n"),"base64url");
}
async function github(path:string,token:string,transport:typeof fetch,body?:unknown):Promise<unknown>{
  const result=await transport("https://api.github.com"+path,{method:body===undefined?"GET":"POST",headers:{Accept:"application/vnd.github+json",Authorization:"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"TeamFlow-Guard","Content-Type":"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!result.ok)throw Error("GitHub App request unavailable.");
  // Delivery IDs may exceed Number.MAX_SAFE_INTEGER. Preserve the exact decimal ID before parsing.
  if(path.startsWith("/app/hook/deliveries?"))return JSON.parse((await result.text()).replace(/"id"\s*:\s*(\d{16,})(?=\s*[,}])/g,'"id":"$1"'));
  return result.json();
}
export async function appRepositoryActivity(c:AppConfig,w:string,branch:string,transport:typeof fetch=fetch){
  const b=bindingForWorkspace(c,w);
  if(!b)throw Error("GitHub App not authorized for workspace.");
  const appJWT=jwt(c);
  const minted=obj(await github("/app/installations/"+b.installation_id+"/access_tokens",appJWT,transport,{repository_ids:[b.repository_id],permissions:{metadata:"read",actions:"read",pull_requests:"read"}}));
  if(typeof minted.token!=="string"||!minted.token)throw Error("GitHub App token unavailable.");
  const token=minted.token, slug=b.repository;
  const repo=obj(await github("/repos/"+slug,token,transport));
  if(repo.id!==b.repository_id||typeof repo.full_name!=="string"||repo.full_name.toLowerCase()!==slug.toLowerCase())throw Error("GitHub repository identity changed.");
  const q=new URLSearchParams({branch,per_page:"5"}), p=new URLSearchParams({state:"open",base:branch,per_page:"5",sort:"updated",direction:"desc"});
  const jobs=await Promise.allSettled([github("/repos/"+slug+"/actions/runs?"+q,token,transport),github("/repos/"+slug+"/pulls?"+p,token,transport),c.webhookSecret?.trim()?github("/app/hook/deliveries?per_page=100",appJWT,transport):Promise.resolve([])]);
  const val=(i:number):unknown=>jobs[i].status==="fulfilled"?jobs[i].value:[];
  const rr=obj(val(0)).workflow_runs;
  const runs:PublicRun[]=Array.isArray(rr)?rr.slice(0,5).flatMap(v=>{const r=obj(v);return positive(r.id)?[{id:r.id,name:txt(r.name)||"Workflow",status:txt(r.status,40)||"unknown",conclusion:txt(r.conclusion,40)||null,html_url:"https://github.com/"+slug+"/actions/runs/"+r.id,created_at:txt(r.created_at,60),head_branch:txt(r.head_branch,100)||null}]:[];}):[];
  const pr=val(1);
  const pulls:Pull[]=Array.isArray(pr)?pr.slice(0,5).flatMap(v=>{const r=obj(v);return positive(r.number)?[{number:r.number,title:txt(r.title)||"Pull request",draft:r.draft===true,updated_at:txt(r.updated_at,60),html_url:"https://github.com/"+slug+"/pull/"+r.number}]:[];}):[];
  const dr=val(2);
  const deliveries:Delivery[]=Array.isArray(dr)?dr.flatMap(v=>{const r=obj(v),id=deliveryId(r.id);return r.installation_id===b.installation_id&&r.repository_id===b.repository_id&&id!==null&&positive(r.status_code)&&["workflow_run","pull_request","pull_request_review"].includes(String(r.event))?[{id,event:txt(r.event,50),action:txt(r.action,50)||null,status_code:r.status_code,delivered_at:txt(r.delivered_at,60)}]:[];}).slice(0,5):[];
  return {runs,pulls,deliveries,warning:jobs.some(j=>j.status==="rejected")?"Some GitHub activity is temporarily unavailable.":null,observed_at:new Date().toISOString()};
}
export function validWebhookSignature(raw:Uint8Array,sig:string|null,secret?:string){
  if(!secret?.trim()||!sig||!/^sha256=[a-f0-9]{64}$/i.test(sig))return false;
  return timingSafeEqual(createHmac("sha256",secret).update(raw).digest(),Buffer.from(sig.slice(7),"hex"));
}
export function webhookMatchesBinding(c:AppConfig,event:string,payload:unknown){
  if(!["workflow_run","pull_request","pull_request_review"].includes(event))return false;
  const p=obj(payload), i=obj(p.installation), r=obj(p.repository);
  return parseBindings(c.bindings).some(b=>b.installation_id===i.id&&b.repository_id===r.id);
}

export async function appReviewObservation(c:AppConfig,w:string,branch:string,mapping:ReviewMapping,transport:typeof fetch=fetch){
  const b=bindingForWorkspace(c,w);
  if(!b||mapping.workspace_id.toLowerCase()!==w.toLowerCase())throw Error("GitHub App not authorized for workspace.");
  const minted=obj(await github("/app/installations/"+b.installation_id+"/access_tokens",jwt(c),transport,{repository_ids:[b.repository_id],permissions:{metadata:"read",pull_requests:"read"}}));
  if(typeof minted.token!=="string"||!minted.token)throw Error("GitHub App token unavailable.");
  const token=minted.token,slug=b.repository;
  const repo=obj(await github("/repos/"+slug,token,transport));
  if(repo.id!==b.repository_id||typeof repo.full_name!=="string"||repo.full_name.toLowerCase()!==slug.toLowerCase())throw Error("GitHub repository identity changed.");
  // Capture observation order before reading GitHub; a slow older request must not overwrite a newer one.
  const now=new Date();
  const pullPath="/repos/"+slug+"/pulls/"+mapping.pull_number;
  const pull=await github(pullPath,token,transport);
  const timeline=await github("/repos/"+slug+"/issues/"+mapping.pull_number+"/timeline?per_page=100",token,transport);
  const current=await github(pullPath,token,transport);
  if(reviewStateFingerprint(pull)!==reviewStateFingerprint(current))throw Error("GitHub review changed during observation; retry.");
  return reviewObservation({mapping,repositoryId:b.repository_id,repository:slug,branch,pull,timeline,now});
}
