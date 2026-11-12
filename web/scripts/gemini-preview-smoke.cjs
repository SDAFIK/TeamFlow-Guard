// Read-only live delivery verification; App key stays in the preview environment.
const {createSign}=require("node:crypto");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 (async()=>{
 const id=process.env.GITHUB_APP_ID,key=process.env.GITHUB_APP_PRIVATE_KEY;
 if(id!=="5735990"||!key)throw Error("missing configuration");
 const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const body=enc({alg:"RS256",typ:"JWT"})+"."+enc({iat:now-60,exp:now+480,iss:id});
 const sign=createSign("RSA-SHA256");sign.update(body);const jwt=body+"."+sign.sign(key.replace(/\\n/g,"\n"),"base64url");
 const headers={Accept:"application/vnd.github+json",Authorization:"Bearer "+jwt,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json","User-Agent":"TeamFlow-Guard"};
 const api=async(path)=>{const r=await fetch("https://api.github.com"+path,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("GitHub API HTTP "+r.status+" "+path);// GitHub delivery IDs are unsigned 64-bit values; preserve them as decimal strings.
 const raw=await r.text();return JSON.parse(raw.replace(/"id"\s*:\s*(\d{16,})(?=\s*[,}])/g,'"id":"$1"'));};
 const app=await api("/app");if(app.id!==5735990)throw Error("App identity mismatch");
 console.log("GITHUB_APP_EVENTS: "+JSON.stringify(app.events??[]));
 const list=await api("/app/hook/deliveries?per_page=100");let matched=null;
 for(const d of list.filter(d=>d.event==="workflow_run"&&d.action==="completed").slice(0,35)){
  const delivery=await api("/app/hook/deliveries/"+d.id);const raw=delivery.request?.payload;const p=typeof raw==="string"?JSON.parse(raw):raw;
  if(p?.workflow_run?.id===43324780151&&p?.workflow_run?.head_branch==="codex/github-live-sandbox"&&p?.workflow_run?.conclusion==="success"&&p?.repository?.id===1450114794&&p?.installation?.id===181405240){matched={delivery_id:d.id,event:d.event,action:d.action,status_code:d.status_code,delivered_at:d.delivered_at,run_id:p.workflow_run.id,workflow_id:p.workflow_run.workflow_id,repository_id:p.repository.id,installation_id:p.installation.id,branch:p.workflow_run.head_branch,conclusion:p.workflow_run.conclusion};break;}
 }
 console.log("TEAMFLOW_LIVE_DELIVERY: "+JSON.stringify(matched));
 if(!matched||matched.status_code!==204)throw Error("exact live recovery delivery not accepted");
 console.log("TEAMFLOW_LIVE_DELIVERY: PASS genuine GitHub signed recovery workflow_run reached production receiver; intentionally unmapped, no database write");
 })().catch(e=>{console.error("TEAMFLOW_LIVE_DELIVERY: FAIL "+(e instanceof Error&&/^(GitHub API HTTP|missing configuration|App identity mismatch|exact live recovery delivery)/.test(e.message)?e.message:"verification unavailable"));process.exitCode=1;});
}
