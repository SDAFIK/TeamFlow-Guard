"use client";
import {useCallback,useEffect,useState} from "react";
import {CheckCircle2, CircleAlert, GitBranch, Mail, RefreshCw, ShieldCheck} from "lucide-react";
import {api} from "@/lib/api";
import {Busy} from "./ui";
import {GithubMappingPanel} from "./github-mapping-panel";
type Readiness={can_manage?:boolean;review_mappings?:{pull_number:number;task_id:string;reviewer_id:string;valid:boolean}[];repository:string|null;app_bound:boolean;app_credentials:boolean;webhook_configured:boolean;ingestion_configured:boolean;mappings:{workflow_id:number;task_id:string;task_key:string|null;task_title:string|null;valid:boolean}[];tracked_branch:string;email_configured:boolean;is_demo:boolean};
export function IntegrationReadiness({workspaceId}:{workspaceId:string}){
 const [data,setData]=useState<Readiness|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{setLoading(true);setError("");try{setData(await api<Readiness>(`/projects/${workspaceId}/github-readiness`));}catch{setError("Unable to check integration configuration. Retry.");}finally{setLoading(false);}},[workspaceId]);
 useEffect(()=>{
  let active=true;
  void api<Readiness>(`/projects/${workspaceId}/github-readiness`).then(next=>{if(active)setData(next);}).catch(()=>{if(active)setError("Unable to check integration configuration. Retry.");}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[workspaceId]);
 const checks=data?[["Repository authorization",data.app_bound],["App credentials",data.app_credentials],["Webhook secret",data.webhook_configured],["Evidence ingestion credential",data.ingestion_configured],["Valid task mappings",data.mappings.length>0&&data.mappings.every(m=>m.valid)]] as const:[];
 return <section className="panel settings-panel integration-readiness" aria-label="Integration readiness">
  <div className="settings-section-header"><span className="section-kicker"><ShieldCheck size={15}/> INTEGRATION SETUP</span><h2>Connect with confidence</h2><p>Configuration checks, not proof of live delivery. GitHub activity and actual webhook receipts are checked separately.</p></div>
  <button className="secondary" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={15}/> Check configuration</button>
  {loading?<Busy text="Checking integration configuration…"/>:error?<p className="error" role="alert">{error}</p>:data&&<>
  <div className="integration-readiness-grid">{checks.map(([label,ready])=><div key={label} className="integration-check">{ready?<CheckCircle2 size={18}/>:<CircleAlert size={18}/>}<div><strong>{label}</strong><small>{ready?"Configured":"Setup required"}</small></div></div>)}</div>
  <div className="human-note"><GitBranch size={18}/><span>Tracked branch: <strong>{data.tracked_branch}</strong>. {data.is_demo?"Demo workspaces never ingest live GitHub events.":"An administrator authorizes the repository. Workspace managers can then map its workflows and requested PR reviews to tasks."}</span></div>
  <h3>Workflow-to-task mappings</h3>
  {data.mappings.length?<div className="integration-mappings">{data.mappings.map(m=><div key={m.workflow_id} className="integration-check"><GitBranch size={16}/><div><strong>Workflow #{m.workflow_id}</strong><small>{m.valid?m.task_key+" · "+m.task_title:"Mapped task unavailable — administrator review required"}</small></div></div>)}</div>:<p className="field-help">No workflow mappings configured. A manager can map an authorized workflow to a saved task.</p>}
  {(data.review_mappings??[]).length>0&&<><h3>Pull-request review mappings</h3><div className="integration-mappings">{data.review_mappings!.map(m=><div key={m.pull_number} className="integration-check"><GitBranch size={16}/><div><strong>PR #{m.pull_number}</strong><small>{m.valid?"Task and reviewer mapping configured":"Mapping needs review"}</small></div></div>)}</div></>}
  {data.app_bound&&data.can_manage&&data.ingestion_configured&&!data.is_demo&&<GithubMappingPanel workspaceId={workspaceId} onSaved={refresh}/>}
  <div className="integration-check"><Mail size={18}/><div><strong>Direct invitation email</strong><small>{data.email_configured?"Provider configured; inbox delivery not verified":"Manual invitation links available; email provider not configured"}</small></div></div>
  </>}
 </section>;
}
