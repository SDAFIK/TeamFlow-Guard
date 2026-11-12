// Dedicated diagnostic: redeliver only two previously verified sandbox events.
const {createSign}=require("node:crypto");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 (async()=>{
 const id=process.env.GITHUB_APP_ID,key=process.env.GITHUB_APP_PRIVATE_KEY;if(id!=="5735990"||!key)throw Error("missing credentials");
 const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const body=enc({alg:"RS256",typ:"JWT"})+"."+enc({iat:now-60,exp:now+480,iss:id});
 const sign=createSign("RSA-SHA256");sign.update(body);const jwt=body+"."+sign.sign(key.replace(/\\n/g,"\n"),"base64url");
 const headers={Accept:"application/vnd.github+json",Authorization:"Bearer "+jwt,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json","User-Agent":"TeamFlow-Guard"};
 const api=async(path,method="GET")=>{const r=await fetch("https://api.github.com"+path,{method,headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("GitHub API HTTP "+r.status+" "+path);const raw=await r.text();return raw?JSON.parse(raw.replace(/"id"\s*:\s*(\d{16,})(?=\s*[,}])/g,'"id":"$1"')):null;};
 const app=await api("/app");if(app.id!==5735990)throw Error("wrong App");console.log("GITHUB_APP_EVENTS: "+JSON.stringify(app.events??[]));
 const cases=[["3853711283643744256",43324373557,"failure"],["3853711653560475648",43324780151,"success"]];
 const baseline=new Set((await api("/app/hook/deliveries?per_page=100")).map(d=>String(d.id)));
 for(const [delivery,run,conclusion] of cases){
  const d=await api("/app/hook/deliveries/"+delivery);const p=typeof d.request?.payload==="string"?JSON.parse(d.request.payload):d.request?.payload;
  if(p?.workflow_run?.id!==run||p.workflow_run.conclusion!==conclusion||p.workflow_run.head_branch!=="codex/github-live-sandbox"||p.repository?.id!==1450114794||p.installation?.id!==181405240)throw Error("sandbox delivery identity mismatch");
  await api("/app/hook/deliveries/"+delivery+"/attempts","POST");
  let accepted=false;
  for(let i=0;i<24;i++){await new Promise(r=>setTimeout(r,2500));const list=await api("/app/hook/deliveries?per_page=100");for(const x of list.filter(x=>!baseline.has(String(x.id))&&x.guid===d.guid&&x.redelivery)){if(x.status_code===202){baseline.add(String(x.id));console.log("TEAMFLOW_MAPPED_DELIVERY: "+JSON.stringify({run,conclusion,delivery_id:String(x.id),status_code:x.status_code}));accepted=true;break;}if(x.status_code&&x.status_code!==202)throw Error("redelivery HTTP "+x.status_code);}if(accepted)break;}
  if(!accepted)throw Error("mapped redelivery not confirmed");
 }
 console.log("TEAMFLOW_MAPPED_DELIVERY: PASS both actual GitHub redeliveries accepted");
 })().catch(e=>{console.error("TEAMFLOW_MAPPED_DELIVERY: FAIL "+(e instanceof Error&&/^(GitHub API HTTP|wrong App|missing credentials|sandbox delivery identity mismatch|redelivery HTTP|mapped redelivery)/.test(e.message)?e.message:"verification unavailable"));process.exitCode=1;});
}
