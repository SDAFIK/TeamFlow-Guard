"use client";
import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,CircleAlert,GitBranch,Mail,RefreshCw,ShieldCheck,Sparkles} from "lucide-react";
import {api} from "@/lib/api";
import {aiReadinessDiagnostic,githubReadinessDiagnostic,type AiReadiness,type GithubReadinessSnapshot} from "@/domain/integration-readiness";
import {Busy} from "./ui";
import {GithubMappingPanel} from "./github-mapping-panel";

type Readiness=GithubReadinessSnapshot&{
  can_manage?:boolean;
  review_mappings?:{pull_number:number;task_id:string;reviewer_id:string;valid:boolean}[];
  mappings:{workflow_id:number;task_id:string;task_key:string|null;task_title:string|null;valid:boolean}[];
  tracked_branch:string;
  email_configured:boolean;
};

export function IntegrationReadiness({workspaceId,aiStatus}:{workspaceId:string;aiStatus:AiReadiness}){
 const [data,setData]=useState<Readiness|null>(null);
 const [error,setError]=useState(""),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
   setLoading(true);setError("");
   try{setData(await api<Readiness>(`/projects/${workspaceId}/github-readiness`));}
   catch{setError("Unable to check integration configuration. Retry; your existing connections were not changed.");}
   finally{setLoading(false);}
 },[workspaceId]);
 useEffect(()=>{
   let active=true;
   void api<Readiness>(`/projects/${workspaceId}/github-readiness`)
    .then(next=>{if(active)setData(next);})
    .catch(()=>{if(active)setError("Unable to check integration configuration. Retry; your existing connections were not changed.");})
    .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;};
 },[workspaceId]);
 const github=data?githubReadinessDiagnostic(data):null;
 const ai=aiReadinessDiagnostic(aiStatus);
 const checks=data?[
   {label:"Repository authorization",ready:Boolean(data.repository)},
   ...(data.app_bound?[
     {label:"App credentials",ready:data.app_credentials},
     {label:"Webhook secret",ready:data.webhook_configured},
     {label:"Evidence ingestion credential",ready:data.ingestion_configured},
     {label:"Valid task mappings",ready:[...data.mappings,...(data.review_mappings??[])].length>0&&[...data.mappings,...(data.review_mappings??[])].every(m=>m.valid)},
   ]:[]),
 ]:[];
 return <section className="panel settings-panel integration-readiness" aria-label="Integration readiness">
  <div className="settings-section-header">
   <span className="section-kicker"><ShieldCheck size={15}/> INTEGRATION SETUP</span>
   <h2>Connect with confidence</h2>
   <p>Read-only configuration checks, not proof of live provider connectivity. No AI request or GitHub webhook is triggered by this page.</p>
  </div>
  <div className="integration-readiness-diagnostics" aria-label="AI configuration">
   <div className="human-note"><Sparkles size={18}/><div><strong>{ai.label}</strong><p>{ai.explanation}</p><p><strong>Next:</strong> {ai.nextAction}</p></div></div>
  </div>
  <button className="secondary" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15}/> Check configuration</button>
  {loading?<Busy text="Checking integration configuration…"/>:error?<p className="error" role="alert">{error}</p>:data&&github&&<>
   <div className="human-note" role="status"><GitBranch size={18}/><div><strong>{github.label}</strong><p>{github.explanation}</p><p><strong>Next:</strong> {github.nextAction}</p></div></div>
   <div className="integration-readiness-grid">
    {checks.map(({label,ready})=><div key={label} className="integration-check">
     {ready?<CheckCircle2 size={18}/>:<CircleAlert size={18}/>}
     <div><strong>{label}</strong><small>{ready?"Configured":"Setup required"}</small></div>
    </div>)}
   </div>
   <div className="human-note"><GitBranch size={18}/><span>Tracked branch: <strong>{data.tracked_branch}</strong>. {data.is_demo?"Fictional events only; live integration is disabled.":data.app_bound?"Administrator-authorized GitHub App. A workspace manager can map workflows and requested reviews.":"Public repository links show read-only activity. Signed evidence requires separate GitHub App authorization."}</span></div>
   {data.app_bound&&<>
    <h3>Workflow-to-task mappings</h3>
    {data.mappings.length?<div className="integration-mappings">{data.mappings.map(m=><div key={m.workflow_id} className="integration-check"><GitBranch size={16}/><div><strong>Workflow #{m.workflow_id}</strong><small>{m.valid?m.task_key+" · "+m.task_title:"Mapped task unavailable — administrator review required"}</small></div></div>)}</div>:<p className="field-help">No workflow mapping yet. Requested review mappings can also link evidence to saved tasks.</p>}
    {(data.review_mappings??[]).length>0&&<><h3>Pull-request review mappings</h3><div className="integration-mappings">{data.review_mappings!.map(m=><div key={m.pull_number} className="integration-check"><GitBranch size={16}/><div><strong>PR #{m.pull_number}</strong><small>{m.valid?"Task and reviewer mapping configured":"Mapping needs review"}</small></div></div>)}</div></>}
   </>}
   {data.app_bound&&data.can_manage&&data.ingestion_configured&&!data.is_demo&&<GithubMappingPanel workspaceId={workspaceId} onSaved={refresh}/>}
   <div className="integration-check"><Mail size={18}/><div><strong>Direct invitation email</strong><small>{data.email_configured?"Provider configured; inbox delivery not verified":"Manual invitation links available; email provider not configured"}</small></div></div>
  </>}
 </section>;
}
