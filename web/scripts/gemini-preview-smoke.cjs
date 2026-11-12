// Test stable production receiver with ping only; never map or mutate tasks.
const {createHmac}=require("node:crypto");
if(process.env.VERCEL_ENV==="preview"&&process.env.VERCEL_GIT_COMMIT_REF==="codex/gemini-live-smoke"){
 (async()=>{
 const secret=process.env.GITHUB_APP_WEBHOOK_SECRET;if(!secret)throw Error("missing signing configuration");
 const url="https://teamflow-guard.vercel.app/api/github/webhook",body=JSON.stringify({zen:"TeamFlow isolated signature acceptance"});
 const signature="sha256="+createHmac("sha256",secret).update(body).digest("hex");
 const call=async(sig)=>{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","X-GitHub-Event":"ping","X-Hub-Signature-256":sig},body,redirect:"error",signal:AbortSignal.timeout(15000)});return r.status;};
 const invalid=await call("sha256="+"0".repeat(64)),valid=await call(signature);
 console.log("TEAMFLOW_RECEIVER_SMOKE: invalid="+invalid+" valid="+valid);
 if(invalid!==401||valid!==204)throw Error("unexpected receiver status");
 console.log("TEAMFLOW_RECEIVER_SMOKE: PASS signature rejection and acceptance; no database mutation");
 })().catch(()=>{console.error("TEAMFLOW_RECEIVER_SMOKE: FAIL");process.exitCode=1;});
}
