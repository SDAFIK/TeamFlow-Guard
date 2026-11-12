// One-off dedicated preview configuration; secrets stay in server environment.
const {createSign}=require("node:crypto");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 (async()=>{
 const id=process.env.GITHUB_APP_ID,key=process.env.GITHUB_APP_PRIVATE_KEY,secret=process.env.GITHUB_APP_WEBHOOK_SECRET;
 if(id!=="5735990"||!key||!secret)throw Error("missing configuration");
 const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const body=enc({alg:"RS256",typ:"JWT"})+"."+enc({iat:now-60,exp:now+480,iss:id});
 const sign=createSign("RSA-SHA256");sign.update(body);
 const jwt=body+"."+sign.sign(key.replace(/\\n/g,"\n"),"base64url");
 const headers={Accept:"application/vnd.github+json",Authorization:"Bearer "+jwt,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json","User-Agent":"TeamFlow-Guard"};
 const api=async(path,options={})=>{const r=await fetch("https://api.github.com"+path,{headers,signal:AbortSignal.timeout(15000),...options});if(!r.ok)throw Error("GitHub API HTTP "+r.status+" "+path);return r.json();};
 const app=await api("/app");if(app.id!==5735990)throw Error("App identity mismatch");
 console.log("GITHUB_APP_EVENTS: "+JSON.stringify(app.events??[]));
 const url="https://teamflow-guard.vercel.app/api/github/webhook";
 const config=await api("/app/hook/config",{method:"PATCH",body:JSON.stringify({url,content_type:"json",insecure_ssl:"0",secret})});
 if(config.url!==url||config.insecure_ssl!=="0"&&config.insecure_ssl!==0)throw Error("Webhook config mismatch");
 console.log("GITHUB_WEBHOOK_CONFIG: PASS URL, JSON, HTTPS verification and signing secret configured");
 const deliveries=await api("/app/hook/deliveries?per_page=20");
 console.log("GITHUB_WEBHOOK_DELIVERIES: "+JSON.stringify(deliveries.map(d=>({event:d.event,status_code:d.status_code,delivered_at:d.delivered_at}))));
 })().catch(e=>{console.error("GITHUB_WEBHOOK_SETUP: FAIL "+(e instanceof Error&&/^(GitHub API HTTP|missing configuration|App identity mismatch|Webhook config mismatch)/.test(e.message)?e.message:"configuration unavailable"));process.exitCode=1;});
}
