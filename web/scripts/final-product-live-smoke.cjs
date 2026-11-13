const {createSign}=require("node:crypto");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/final-product-live-smoke"){
(async()=>{
 const origin="https://teamflow-guard.vercel.app";
 const routes=["/","/login","/overview","/intelligence","/risks","/tasks","/dependencies","/decisions","/capacity","/audit","/settings"];
 for(const path of routes){const response=await fetch(origin+path,{redirect:"follow",signal:AbortSignal.timeout(15000)});const html=await response.text();if(response.status!==200||!html.toLowerCase().includes("teamflow"))throw Error("PAGE "+path+" "+response.status);console.log("FINAL_PUBLIC_PAGE: "+path+" HTTP "+response.status);}
 const health=await fetch(origin+"/api/health",{signal:AbortSignal.timeout(15000)});if(health.status!==200||(await health.json()).message!=="alive")throw Error("health failed");
 const auth=await fetch(origin+"/api/me",{signal:AbortSignal.timeout(15000)});if(auth.status!==401)throw Error("auth boundary failed");
 console.log("FINAL_PRODUCTION_SMOKE: PASS public routes, health and unauthenticated API denial");
 const id=process.env.GITHUB_APP_ID,key=process.env.GITHUB_APP_PRIVATE_KEY;if(id!=="5735990"||!key)throw Error("App configuration absent");
 const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const body=enc({alg:"RS256",typ:"JWT"})+"."+enc({iat:now-60,exp:now+480,iss:id});
 const sign=createSign("RSA-SHA256");sign.update(body);const jwt=body+"."+sign.sign(key.replace(/\\n/g,"\n"),"base64url");
 const headers={Accept:"application/vnd.github+json",Authorization:"Bearer "+jwt,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"TeamFlow-Guard"};
 const r=await fetch("https://api.github.com/app",{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error("App HTTP "+r.status);
 const app=await r.json();if(app.id!==5735990)throw Error("App identity mismatch");
 console.log("FINAL_GITHUB_SUBSCRIPTIONS: "+JSON.stringify(app.events??[]));
 const config=await fetch("https://api.github.com/app/hook/config",{headers,signal:AbortSignal.timeout(15000)});if(!config.ok)throw Error("webhook config unavailable");const c=await config.json();console.log("FINAL_GITHUB_WEBHOOK_CONFIG: "+JSON.stringify({correct_url:c.url===origin+"/api/github/webhook",ssl:c.insecure_ssl==="0"||c.insecure_ssl===0,content_type:c.content_type}));
})().catch(e=>{console.error("FINAL_PRODUCT_SMOKE: FAIL "+(e instanceof Error&&/^(PAGE|health failed|auth boundary failed|App configuration absent|App HTTP|App identity mismatch|webhook config unavailable)/.test(e.message)?e.message:"network or verification unavailable"));process.exitCode=1;});
}
