/* Real application + real LOCAL Supabase Auth/PostgREST acceptance.
 * All accounts, repository IDs and signed webhook events are fictional.
 * Refuses any non-loopback backend; never reads hosted credentials.
 */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createHmac, randomUUID } = require("node:crypto");
const path = require("node:path");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const BASE="http://127.0.0.1:3100";
const URL_LOCAL=process.env.STAGE8_LOCAL_SUPABASE_URL;
const ANON=process.env.STAGE8_LOCAL_ANON_KEY;
const SERVICE=process.env.STAGE8_LOCAL_SERVICE_ROLE;
const parsed=new URL(URL_LOCAL||"http://invalid");
assert.equal(parsed.protocol,"http:");
assert.ok(["localhost","127.0.0.1"].includes(parsed.hostname)&&parsed.port==="54321","Refusing non-local Supabase");
assert.ok(ANON&&SERVICE,"Local credentials required");
const admin=createClient(URL_LOCAL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const password="Fixture-"+randomUUID()+"-A9!";
const nonce=randomUUID().slice(0,8);
const emails=["owner","member","outsider"].map(s=>s+"-"+nonce+"@example.test");
const fixtureSecret=randomUUID()+randomUUID();
let server;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(extra={}){
  const env={...process.env,TEAMFLOW_BACKEND:"supabase",NEXT_PUBLIC_SUPABASE_URL:URL_LOCAL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:ANON,APP_BASE_URL:BASE,APP_ALLOWED_ORIGINS:BASE,RESEND_API_KEY:"",TEAMFLOW_INVITE_EMAIL_FROM:"",GEMINI_API_KEY:"",GITHUB_APP_ID:"",GITHUB_APP_PRIVATE_KEY:"",GITHUB_APP_WEBHOOK_SECRET:"",TEAMFLOW_GITHUB_APP_BINDINGS:"[]",TEAMFLOW_GITHUB_CI_MAPPINGS:"[]",TEAMFLOW_GITHUB_INGEST_KEY:"",...extra};
  delete env.VERCEL;delete env.VERCEL_URL;
  server=spawn(process.execPath,[path.resolve(__dirname,"../web/node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","3100"],{cwd:path.resolve(__dirname,"../web"),env,stdio:"ignore"});
  for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error("Local app exited");try{if((await fetch(BASE+"/api/health")).ok)return;}catch{}await wait(1000);}
  throw Error("Local app did not start");
}
async function stop(){if(!server)return;const s=server;server=undefined;if(s.exitCode!==null)return;s.kill("SIGTERM");await Promise.race([new Promise(r=>s.once("exit",r)),wait(5000)]);if(s.exitCode===null)s.kill("SIGKILL");await wait(500);}
async function call(page,route,method="GET",body,expected=200,headers={}){
  const r=await page.request.fetch(BASE+"/api"+route,{method,headers:{Origin:BASE,"Content-Type":"application/json",...headers},...(body===undefined?{}:{data:body})});
  assert.equal(r.status(),expected,method+" "+route+" unexpected status");
  return r.headers()["content-type"]?.includes("json")?r.json():null;
}
async function login(page,email){
  await page.goto(BASE+"/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  const response=page.waitForResponse(r=>r.url().endsWith("/api/auth/login")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  assert.equal((await response).status(),200,"real password login");
  return call(page,"/me");
}
async function event(payload,valid=true){
  const raw=JSON.stringify(payload);
  const signature="sha256="+createHmac("sha256",valid?fixtureSecret:"wrong").update(raw).digest("hex");
  return (await fetch(BASE+"/api/github/webhook",{method:"POST",headers:{"Content-Type":"application/json","x-github-event":"workflow_run","x-hub-signature-256":signature},body:raw})).status;
}
(async()=>{
 let browser;
 try{
  for(const email of emails){const {error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error("Local fixture user creation failed");}
  await start();
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const ownerPage=await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  const memberPage=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
  const outsiderPage=await (await browser.newContext()).newPage();
  const owner=await login(ownerPage,emails[0]), member=await login(memberPage,emails[1]);
  await login(outsiderPage,emails[2]);
  const workspace=await call(ownerPage,"/projects","POST",{name:"Stage 8 isolated acceptance",display_name:"Fixture Owner"});
  const w=workspace.id, base="/projects/"+w;
  const invite=await call(ownerPage,base+"/invitations","POST",{email:emails[1],role:"member"});
  assert.equal(invite.email_status,"not_requested");
  await call(outsiderPage,"/invitations/accept","POST",{token:invite.token,display_name:"Wrong person"},403);
  await call(memberPage,"/invitations/accept","POST",{token:invite.token,display_name:"Fixture Member"});
  await call(memberPage,base+"/invitations","POST",{email:emails[2],role:"viewer"},403);
  await call(outsiderPage,base+"/dashboard","GET",undefined,404);
  const dash=()=>call(ownerPage,base+"/dashboard");
  let d=await dash();
  const task=await call(ownerPage,base+"/tasks","POST",{key:"CI-101",title:"Authentication integration",owner_id:owner.id,estimate_hours:8,due_at:null,base_plan_version:d.plan_version});
  d=await dash();
  const next=await call(ownerPage,base+"/tasks","POST",{key:"CI-102",title:"Checkout integration",owner_id:member.id,estimate_hours:8,due_at:null,base_plan_version:d.plan_version});
  d=await dash();
  const proposal=await call(ownerPage,base+"/proposals","POST",{title:"Connect the CI tasks",base_plan_version:d.plan_version,actions:[{task_id:next.id,field:"dependency",before:null,after:task.id}]});
  await call(ownerPage,"/proposals/"+proposal.id+"/decision","POST",{decision:"approve",base_plan_version:proposal.base_plan_version},200,{"Idempotency-Key":randomUUID()});
  const shared=await call(memberPage,base+"/dashboard");
  assert.equal(shared.tasks.length,2);
  assert.equal(shared.members.length,2);
  const graph=await call(memberPage,base+"/dependencies?selected="+task.id);
  assert.ok(graph.downstream_ids.includes(next.id));
  console.log("PASS real Auth, email-bound invitation, shared workspace, outsider denial and dependency approval");
  await stop();
  await start({GITHUB_APP_WEBHOOK_SECRET:fixtureSecret,TEAMFLOW_GITHUB_APP_BINDINGS:JSON.stringify([{workspace_id:w,installation_id:101,repository_id:202,repository:"fixture/isolated"}]),TEAMFLOW_GITHUB_CI_MAPPINGS:JSON.stringify([{workspace_id:w,workflow_id:303,task_id:task.id}]),TEAMFLOW_GITHUB_INGEST_KEY:SERVICE});
  const ready=await call(ownerPage,base+"/github-readiness");
  assert.equal(ready.mappings[0].task_id,task.id);
  assert.equal(ready.mappings[0].valid,true);
  assert.equal(ready.app_credentials,false,"fictional App is not actually authorized");
  const at=new Date(Date.now()-10000).toISOString();
  const payload={action:"completed",installation:{id:101},repository:{id:202,full_name:"fixture/isolated"},workflow_run:{id:701,workflow_id:303,run_attempt:1,head_branch:"main",status:"completed",conclusion:"failure",updated_at:at}};
  assert.equal(await event(payload,false),401);
  assert.equal(await event({...payload,repository:{id:999,full_name:"fixture/isolated"}}),204);
  assert.equal(await event(payload),202);
  assert.equal(await event(payload),202);
  const signals=await call(ownerPage,base+"/risks");
  const risk=signals.find(r=>r.active&&r.evidence.kind==="ci_failure");
  assert.ok(risk,"signed failure creates active risk");
  assert.equal(signals.filter(r=>r.evidence.kind==="ci_failure").length,1);
  assert.equal(risk.evidence.task_id,task.id);
  assert.ok(risk.affected_task_ids.includes(next.id));
  await ownerPage.goto(BASE+"/risks");
  await ownerPage.getByRole("region",{name:"Risk protection overview"}).waitFor();
  await ownerPage.locator(".risk-feed").getByText("CI run #701: failure",{exact:true}).waitFor();
  await memberPage.goto(BASE+"/risks");
  await memberPage.getByRole("region",{name:"Risk protection overview"}).waitFor();
  await memberPage.locator(".risk-feed").getByText("CI run #701: failure",{exact:true}).waitFor();
  assert.equal(await memberPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const options=await call(ownerPage,"/risks/"+risk.id+"/recovery-options");
  assert.ok(options.options.some(o=>o.id==="priority"));
  const recovery=await call(ownerPage,"/risks/"+risk.id+"/analyze?mode=rules&strategy=priority","POST",undefined,200,{"Idempotency-Key":randomUUID()});
  assert.equal(recovery.status,"pending");
  assert.equal((await dash()).tasks.find(t=>t.id===task.id).priority,"normal");
  await call(memberPage,"/proposals/"+recovery.id+"/decision","POST",{decision:"approve",base_plan_version:recovery.base_plan_version},403,{"Idempotency-Key":randomUUID()});
  await call(ownerPage,"/proposals/"+recovery.id+"/decision","POST",{decision:"approve",base_plan_version:recovery.base_plan_version},200,{"Idempotency-Key":randomUUID()});
  assert.equal((await dash()).tasks.find(t=>t.id===task.id).priority,"critical");
  const audit=await call(ownerPage,base+"/audit");
  assert.ok(audit.some(a=>a.kind==="proposal.approved"&&a.proposal_id===recovery.id));
  assert.equal(await event({...payload,workflow_run:{...payload.workflow_run,id:702,conclusion:"success",updated_at:new Date().toISOString()}}),202);
  assert.equal(await event({...payload,workflow_run:{...payload.workflow_run,id:703,updated_at:new Date(Date.now()-20000).toISOString()}}),202);
  assert.equal((await call(memberPage,base+"/risks")).filter(r=>r.active&&r.evidence.kind==="ci_failure").length,0);
  assert.equal((await dash()).tasks.find(t=>t.id===task.id).priority,"critical");
  console.log("PASS signed fixture webhook, deduplication, actual evidence, downstream impact, two browser views, rule-based proposal, human approval, audit and newer success");
 }finally{if(browser)await browser.close();await stop();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
