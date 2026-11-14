/* Stage 1 real-browser acceptance against ONLY disposable local Supabase.
 * No hosted credentials, production workspaces or external email are used. */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {randomUUID}=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const {createClient}=require("@supabase/supabase-js");
const BASE="http://127.0.0.1:3100";
const LOCAL=process.env.STAGE8_LOCAL_SUPABASE_URL;
const ANON=process.env.STAGE8_LOCAL_ANON_KEY;
const SERVICE=process.env.STAGE8_LOCAL_SERVICE_ROLE;
const endpoint=new URL(LOCAL||"http://invalid");
assert.ok(endpoint.protocol==="http:"&&["localhost","127.0.0.1"].includes(endpoint.hostname)&&endpoint.port==="54321","Refusing non-local Supabase");
assert.ok(ANON&&SERVICE,"Missing local-only credentials");
const admin=createClient(LOCAL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const nonce=randomUUID().slice(0,8);
const password="Lifecycle-"+randomUUID()+"-A9!";
const emails=["owner","manager","member","outsider"].map(x=>x+"-"+nonce+"@example.test");
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server;
async function start(){
 const env={...process.env,TEAMFLOW_BACKEND:"supabase",NEXT_PUBLIC_SUPABASE_URL:LOCAL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:ANON,APP_BASE_URL:BASE,APP_ALLOWED_ORIGINS:BASE,RESEND_API_KEY:"",TEAMFLOW_INVITE_EMAIL_FROM:"",GEMINI_API_KEY:"",GITHUB_APP_ID:"",GITHUB_APP_PRIVATE_KEY:"",GITHUB_APP_WEBHOOK_SECRET:"",TEAMFLOW_GITHUB_APP_BINDINGS:"[]",TEAMFLOW_GITHUB_CI_MAPPINGS:"[]",TEAMFLOW_GITHUB_INGEST_KEY:"",NEXT_TELEMETRY_DISABLED:"1"};
 delete env.VERCEL;delete env.VERCEL_URL;
 server=spawn(process.execPath,[path.resolve(__dirname,"../web/node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","3100"],{cwd:path.resolve(__dirname,"../web"),env,stdio:"inherit"});
 for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error("Local app exited");try{if((await fetch(BASE+"/api/health")).ok)return;}catch{}await pause(1000);}
 throw Error("Local app did not start");
}
async function stop(){if(!server||server.exitCode!==null)return;server.kill("SIGTERM");await Promise.race([new Promise(r=>server.once("exit",r)),pause(5000)]);if(server.exitCode===null)server.kill("SIGKILL");}
async function call(page,route,method="GET",body,expected=200){
 console.log("CHECK "+method+" "+route.split("?")[0]);
 const response=await page.request.fetch(BASE+"/api"+route,{timeout:60000,method,headers:{Origin:BASE,"Content-Type":"application/json"},...(body===undefined?{}:{data:body})});
 assert.equal(response.status(),expected,method+" "+route+" unexpected status "+(response.status()===expected?"":await response.text()));
 return response.headers()["content-type"]?.includes("json")?response.json():null;
}
async function login(page,email){
 await page.goto(BASE+"/login");
 await page.getByLabel("Email address").fill(email);
 await page.getByLabel("Password",{exact:true}).fill(password);
 const response=page.waitForResponse(r=>r.url().endsWith("/api/auth/login")&&r.request().method()==="POST");
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 assert.equal((await response).status(),200);
 return call(page,"/me");
}
async function selected(page,id){
 await page.waitForFunction(expected=>document.querySelector("select#project")?.value===expected,id);
}
async function settings(page,id){
 await page.goto(BASE+"/settings");
 await page.getByRole("heading",{name:"Project settings",exact:true}).waitFor();
 await selected(page,id);
 await page.getByRole("heading",{name:"Make this your team's space"}).waitFor();
}
async function choose(page,id){
 await page.locator("select#project").selectOption(id);
 await selected(page,id);
}
async function shot(page,name){
 if(!process.env.TEAMFLOW_ARTIFACT_DIR)return;
 fs.mkdirSync(process.env.TEAMFLOW_ARTIFACT_DIR,{recursive:true});
 await page.screenshot({path:path.join(process.env.TEAMFLOW_ARTIFACT_DIR,name),fullPage:true});
}
(async()=>{
 let browser;
 try{
  for(const email of emails){const {error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error("Local fixture account creation failed: "+error.message);}
  await start();
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const ownerPage=await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
  const managerPage=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
  const memberPage=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
  const outsiderPage=await (await browser.newContext()).newPage();
  const errors=[];
  for(const p of [ownerPage,managerPage,memberPage,outsiderPage])p.on("pageerror",e=>errors.push(e.message));
  const owner=await login(ownerPage,emails[0]);
  await login(managerPage,emails[1]);await login(memberPage,emails[2]);await login(outsiderPage,emails[3]);

  // Create via the existing onboarding UI and rename via the real settings form.
  await ownerPage.getByRole("button",{name:"Create a workspace",exact:true}).click();
  const create=ownerPage.getByRole("dialog",{name:"Your workspace"});
  await create.getByLabel("Your display name").fill("Fixture Owner");
  await create.getByLabel("Workspace name").fill("Lifecycle alpha");
  await create.getByRole("button",{name:"Create empty workspace"}).click();
  await create.waitFor({state:"hidden"});
  const a=(await call(ownerPage,"/projects")).find(p=>p.name==="Lifecycle alpha");
  assert.ok(a&&a.is_owner&&!a.archived_at);
  const base="/projects/"+a.id;
  await settings(ownerPage,a.id);
  await ownerPage.getByLabel("Workspace name",{exact:true}).fill("Lifecycle renamed");
  await ownerPage.getByRole("button",{name:"Save workspace settings"}).click();
  await ownerPage.getByText("Workspace settings saved. Risk rules now use the new values.",{exact:true}).waitFor();
  assert.equal((await call(ownerPage,base+"/settings")).name,"Lifecycle renamed");
  console.log("PASS create and rename through authenticated UI");

  const task=await call(ownerPage,base+"/tasks","POST",{key:"LIFE-1",title:"Preserve this task on archive",owner_id:owner.id,estimate_hours:4,due_at:null,base_plan_version:(await call(ownerPage,base+"/dashboard")).plan_version});
  for(const [p,email,role] of [[managerPage,emails[1],"manager"],[memberPage,emails[2],"member"]]){
   const inv=await call(ownerPage,base+"/invitations","POST",{email,role});
   await call(p,"/invitations/accept","POST",{token:inv.token,display_name:"Fixture "+role});
   for(const operation of ["archive","restore","delete"])await call(p,base+"/lifecycle","POST",operation==="delete"?{operation,confirmed_name:"Lifecycle renamed"}:{operation},403);
   await p.goto(BASE+"/settings");
   await p.getByRole("heading",{name:"Make this your team's space"}).waitFor();
   assert.equal(await p.getByRole("button",{name:"Delete workspace",exact:true}).count(),0);
   assert.equal(await p.getByRole("button",{name:"Archive workspace",exact:true}).count(),0);
  }
  await call(outsiderPage,base+"/lifecycle","POST",{operation:"delete",confirmed_name:"Lifecycle renamed"},403);
  await call(outsiderPage,base+"/dashboard","GET",undefined,404);
  const other=await call(outsiderPage,"/projects","POST",{name:"Unrelated tenant",display_name:"Fixture Outsider"});
  const b=await call(ownerPage,"/projects","POST",{name:"Lifecycle beta",display_name:"Fixture Owner"});
  await ownerPage.goto(BASE+"/overview");await selected(ownerPage,a.id);
  await choose(ownerPage,b.id);await choose(ownerPage,a.id);
  console.log("PASS workspace switching and owner/manager/member/outsider permission boundaries");

  // Archive current workspace; fallback must select the other active workspace.
  await settings(ownerPage,a.id);
  await ownerPage.getByRole("button",{name:"Archive workspace",exact:true}).click();
  await ownerPage.getByRole("button",{name:"Cancel",exact:true}).click();
  assert.equal((await call(ownerPage,"/projects")).find(p=>p.id===a.id).archived_at,null);
  await ownerPage.getByRole("button",{name:"Archive workspace",exact:true}).click();
  await ownerPage.getByRole("button",{name:"Confirm archive",exact:true}).click();
  await selected(ownerPage,b.id);
  const archived=(await call(ownerPage,"/projects")).find(p=>p.id===a.id);
  assert.ok(archived.archived_at);
  const frozen=await call(ownerPage,base+"/dashboard");
  assert.equal(frozen.tasks[0].id,task.id);
  await call(ownerPage,base+"/tasks","POST",{key:"LIFE-2",title:"Must fail while archived",owner_id:owner.id,estimate_hours:1,due_at:null,base_plan_version:frozen.plan_version},409);
  await call(managerPage,base+"/lifecycle","POST",{operation:"restore"},403);
  await ownerPage.getByRole("button",{name:"Switch workspace",exact:true}).click();
  await ownerPage.getByRole("button",{name:"Archived workspaces (1)",exact:true}).click();
  const archivedDialog=ownerPage.getByRole("dialog",{name:"Archived workspaces"});
  await archivedDialog.getByRole("heading",{name:"Lifecycle renamed"}).waitFor();
  await shot(ownerPage,"stage1-archived-desktop.png");
  await archivedDialog.getByRole("button",{name:"Restore workspace"}).click();
  await archivedDialog.getByRole("button",{name:"Confirm restore"}).click();
  await archivedDialog.waitFor({state:"hidden"});
  await selected(ownerPage,a.id);
  const restored=await call(ownerPage,base+"/dashboard");
  assert.equal(restored.tasks[0].id,task.id);
  assert.ok(restored.plan_version>frozen.plan_version);
  assert.equal((await call(ownerPage,"/projects")).find(p=>p.id===a.id).archived_at,null);
  console.log("PASS archive confirmation, safe fallback, read-only archive, restoration and preserved task");

  // Mobile owner deletion: exact persisted name only; delete active and last workspace.
  await ownerPage.setViewportSize({width:390,height:844});
  await settings(ownerPage,a.id);
  await ownerPage.getByRole("button",{name:"Delete workspace",exact:true}).click();
  const confirm=ownerPage.getByRole("form",{name:"Confirm delete workspace"});
  const erase=confirm.getByRole("button",{name:"Delete permanently",exact:true});
  assert.ok(await erase.isDisabled());
  await confirm.getByRole("textbox",{name:"Confirm workspace name"}).fill("Wrong");
  assert.ok(await erase.isDisabled());
  await call(ownerPage,base+"/lifecycle","POST",{operation:"delete",confirmed_name:"Wrong"},422);
  await confirm.getByRole("textbox",{name:"Confirm workspace name"}).fill("Lifecycle renamed");
  assert.equal(await erase.isDisabled(),false);
  await shot(ownerPage,"stage1-delete-confirm-mobile.png");
  assert.equal(await ownerPage.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,"mobile confirmation must fit viewport");
  await erase.click();
  await selected(ownerPage,b.id);
  await call(ownerPage,base+"/dashboard","GET",undefined,404);
  await call(memberPage,base+"/dashboard","GET",undefined,404);
  await call(ownerPage,base+"/lifecycle","POST",{operation:"restore"},403);
  assert.equal((await call(outsiderPage,"/projects")).some(p=>p.id===other.id),true);
  await ownerPage.reload();await selected(ownerPage,b.id);
  await settings(ownerPage,b.id);
  await ownerPage.getByRole("button",{name:"Delete workspace",exact:true}).click();
  await ownerPage.getByRole("textbox",{name:"Confirm workspace name"}).fill("Lifecycle beta");
  await ownerPage.getByRole("button",{name:"Delete permanently",exact:true}).click();
  await ownerPage.getByRole("button",{name:"Create a workspace",exact:true}).waitFor();
  await ownerPage.reload();await ownerPage.getByRole("button",{name:"Create a workspace",exact:true}).waitFor();
  assert.equal((await call(ownerPage,"/projects")).length,0);
  assert.equal(await ownerPage.evaluate(key=>localStorage.getItem(key),"teamflow.workspace."+owner.id),null);
  await shot(ownerPage,"stage1-empty-mobile.png");
  assert.deepEqual(errors,[],"no uncaught browser errors");
  console.log("PASS mobile typed deletion, remaining workspace fallback, last-workspace onboarding, reload persistence and tenant isolation");
  console.log("PASS Stage 1 authenticated browser acceptance: all lifecycle operations; no hosted data used");
  // Stage 2: real per-user demo launcher, deterministic recovery, and safe reset.
  await ownerPage.getByRole("button",{name:"Open personal demo",exact:true}).click();
  await ownerPage.getByRole("heading",{name:"Delivery overview",exact:true}).waitFor();
  const demo=(await call(ownerPage,"/projects")).find(p=>p.personal_demo);
  assert.ok(demo&&demo.is_owner&&demo.is_demo);
  const db="/projects/"+demo.id;
  await selected(ownerPage,demo.id);
  const demoDashboard=await call(ownerPage,db+"/dashboard");
  assert.equal(demoDashboard.members.length,6);
  assert.equal(demoDashboard.tasks.length,10);
  assert.equal(demoDashboard.members.filter(m=>m.demo_persona).length,5);
  assert.equal((await call(ownerPage,db+"/dependencies")).edges.length,9);
  const risks=await call(ownerPage,db+"/risks");
  assert.equal(risks.filter(r=>r.active).length,4);
  const ci=risks.find(r=>r.active&&r.evidence.kind==="ci_failure");
  assert.ok(ci.affected_task_ids.length>=4);
  await call(memberPage,db+"/dashboard","GET",undefined,404);
  await call(memberPage,"/personal-demo","POST",{operation:"reset",workspace_id:demo.id,confirmed_name:demo.name},403);
  await call(ownerPage,db+"/invitations","POST",{email:emails[1],role:"member"},403);
  const same=await call(ownerPage,"/personal-demo","POST",{operation:"open"});
  assert.equal(same.id,demo.id);
  const memberDemo=await call(memberPage,"/personal-demo","POST",{operation:"open"});
  assert.notEqual(memberDemo.id,demo.id);
  await call(ownerPage,"/projects/"+memberDemo.id+"/dashboard","GET",undefined,404);
  await ownerPage.goto(BASE+"/capacity");
  await ownerPage.getByRole("heading",{name:"Team capacity",exact:true}).waitFor();
  for(const name of ["Maya Chen","Ryan Patel","Sara Ahmed","Daniel Kim","Nora Wilson"])await ownerPage.getByRole("heading",{name,exact:true}).waitFor();
  await shot(ownerPage,"stage2-six-person-capacity-mobile.png");
  await ownerPage.setViewportSize({width:1440,height:900});
  await settings(ownerPage,demo.id);
  assert.equal(await ownerPage.getByText("Fictional teammate · no login",{exact:true}).count(),5);
  assert.equal(await ownerPage.getByRole("button",{name:"Generate invitation link"}).count(),0);
  const options=await call(ownerPage,"/risks/"+ci.id+"/recovery-options");
  assert.ok(options.options.length>0,"seeded scenario must yield a feasible recovery");
  const strategy=options.options[0].id;
  const proposal=await call(ownerPage,"/risks/"+ci.id+"/analyze?mode=rules&strategy="+strategy,"POST",{});
  assert.equal(proposal.status,"pending");
  assert.equal((await call(ownerPage,db+"/dashboard")).plan_version,demoDashboard.plan_version);
  const decisionResponse=await ownerPage.request.post(BASE+"/api/proposals/"+proposal.id+"/decision",{headers:{Origin:BASE,"Content-Type":"application/json","Idempotency-Key":randomUUID()},data:{decision:"approve",base_plan_version:proposal.base_plan_version}});
  assert.equal(decisionResponse.status(),200,await decisionResponse.text());
  assert.ok((await call(ownerPage,db+"/dashboard")).plan_version>demoDashboard.plan_version);
  assert.ok((await call(ownerPage,db+"/risks")).some(r=>r.id===ci.id&&r.active),"approval must not clear failing CI");
  await call(ownerPage,db+"/demo-events","POST",{kind:"ci_pass",task_id:ci.evidence.task_id,event_key:randomUUID()});
  assert.equal((await call(ownerPage,db+"/risks")).some(r=>r.id===ci.id&&r.active),false);
  const real=await call(ownerPage,"/projects","POST",{name:"Stage 2 real workspace",display_name:"Fixture Owner"});
  await ownerPage.goto(BASE+"/overview");await selected(ownerPage,demo.id);
  await ownerPage.getByRole("button",{name:"Reset personal demo",exact:true}).click();
  const reset=ownerPage.getByRole("dialog",{name:"Reset personal demo"});
  assert.ok(await reset.getByRole("button",{name:"Reset demo permanently"}).isDisabled());
  await reset.getByLabel("Confirm demo reset name").fill(demo.name);
  await reset.getByRole("button",{name:"Reset demo permanently"}).click();
  await reset.waitFor({state:"hidden"});
  const newDemo=(await call(ownerPage,"/projects")).find(p=>p.personal_demo);
  assert.notEqual(newDemo.id,demo.id);
  await selected(ownerPage,newDemo.id);
  const clean=await call(ownerPage,"/projects/"+newDemo.id+"/dashboard");
  assert.equal(clean.members.length,6);assert.equal(clean.tasks.length,10);
  assert.equal((await call(ownerPage,"/projects/"+newDemo.id+"/proposals")).length,0);
  assert.equal((await call(ownerPage,"/projects/"+real.id+"/dashboard")).tasks.length,0);
  await call(ownerPage,db+"/dashboard","GET",undefined,404);
  await call(memberPage,"/projects/"+memberDemo.id+"/dashboard");
  await shot(ownerPage,"stage2-reset-desktop.png");
  assert.deepEqual(errors,[],"no uncaught browser errors across Stage 1 and Stage 2");
  console.log("PASS Stage 2 authenticated demo: six-person team, ten tasks, four active risk types, isolated users, human-approved recovery, fictional CI recovery and private reset");
  // Stage 3: inspect each actual route at desktop, tablet and narrow mobile sizes.
  const routes=[["overview","Delivery overview"],["intelligence","TIC Intelligence"],["risks","Risk center"],["tasks","Task board"],["dependencies","Dependencies"],["decisions","Decision inbox"],["capacity","Team capacity"],["audit","Audit log"],["settings","Project settings"]];
  for(const width of [1440,1024,768,390,320]){
    await ownerPage.setViewportSize({width,height:900});
    for(const [route,heading] of routes){
      await ownerPage.goto(BASE+"/"+route);
      await ownerPage.getByRole("heading",{name:heading,exact:true}).first().waitFor();
      await selected(ownerPage,newDemo.id);
      assert.equal(await ownerPage.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,"horizontal overflow "+route+" at "+width);
      await shot(ownerPage,"stage3-"+width+"-"+route+".png");
    }
  }
  const publicPage=await (await browser.newContext({reducedMotion:"reduce"})).newPage();
  for(const width of [1440,768,390,320]){
    await publicPage.setViewportSize({width,height:900});
    await publicPage.goto(BASE+"/login");
    await publicPage.getByRole("heading",{name:"Build with clarity. Recover with confidence."}).waitFor();
    await publicPage.getByLabel("Email address").waitFor();
    assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,"login overflow "+width);
    await shot(publicPage,"stage3-"+width+"-login.png");
  }
  await publicPage.getByRole("button",{name:"New here? Create an account"}).click();
  await publicPage.getByRole("button",{name:"Create account",exact:true}).waitFor();
  await publicPage.getByRole("button",{name:"Already have an account? Sign in"}).click();
  await publicPage.getByRole("button",{name:"Sign in",exact:true}).waitFor();
  assert.deepEqual(errors,[],"no uncaught authenticated browser errors");
  console.log("PASS Stage 3 responsive route sweep and public entry controls");
  // V1.1: actual local Auth email delivery, PKCE confirmation, resend and recovery.
  // Only the local Mailpit inbox is inspected; no tokens or email bodies are logged.
  const mailPage=await (await browser.newContext()).newPage();
  const email="recovery-"+nonce+"@example.test";
  const newPassword="Replacement-"+randomUUID()+"-A9!";
  async function latestMail(subject,excluded=[]){
    for(let i=0;i<30;i++){
      const response=await fetch("http://127.0.0.1:54324/api/v1/messages");
      if(!response.ok)throw Error("Local mail inbox unavailable");
      const list=await response.json();
      const message=(list.messages||[]).find(m=>m.To?.some(t=>t.Address===email)&&subject.test(m.Subject)&&!excluded.includes(m.ID));
      if(message){
        const full=await (await fetch("http://127.0.0.1:54324/api/v1/message/"+message.ID)).json();
        const html=full.HTML||"";
        const link=(html.match(/href=["']([^"']*\/auth\/v1\/verify[^"']*)["']/i)||[])[1];
        if(!link)throw Error("Local Auth email lacks verification link");
        const url=new URL(link.replaceAll("&amp;","&"));
        assert.ok(["127.0.0.1","localhost"].includes(url.hostname)&&url.port==="54321","Refusing external verification URL");
        return {id:message.ID,url:url.toString()};
      }
      await pause(1000);
    }
    throw Error("Expected local email did not arrive");
  }
  await mailPage.goto(BASE+"/login");
  await mailPage.getByRole("button",{name:"New here? Create an account"}).click();
  await mailPage.getByLabel("Email address").fill(email);
  await mailPage.getByLabel("Password",{exact:true}).fill(password);
  await mailPage.getByRole("button",{name:"Create account",exact:true}).click();
  await mailPage.getByRole("status").filter({hasText:"Check your email"}).waitFor();
  const original=await latestMail(/confirm/i);
  await pause(1200);
  await call(mailPage,"/auth/resend-confirmation","POST",{email});
  const resent=await latestMail(/confirm/i,[original.id]);
  await mailPage.goto(resent.url);
  await mailPage.waitForURL(BASE+"/overview");
  await call(mailPage,"/me");
  await call(mailPage,"/auth/reset-password","POST",{password:newPassword},403);
  await call(mailPage,"/auth/logout","POST",{});
  await mailPage.goto(BASE+"/login");
  await mailPage.getByRole("button",{name:"Forgot password?"}).click();
  await mailPage.getByLabel("Email address").fill(email);
  await mailPage.getByRole("button",{name:"Send reset link"}).click();
  await mailPage.getByRole("status").filter({hasText:"password reset link"}).waitFor();
  const recovery=await latestMail(/reset|recover/i);
  await mailPage.goto(recovery.url);
  await mailPage.waitForURL(BASE+"/reset-password");
  await mailPage.getByLabel("New password",{exact:true}).fill(newPassword);
  await mailPage.getByLabel("Confirm new password",{exact:true}).fill(password);
  await mailPage.getByRole("button",{name:"Update password"}).click();
  await mailPage.getByRole("alert").filter({hasText:"Passwords do not match"}).waitFor();
  await mailPage.getByLabel("Confirm new password",{exact:true}).fill(newPassword);
  await mailPage.getByRole("button",{name:"Update password"}).click();
  await mailPage.getByRole("status").filter({hasText:"Password updated"}).waitFor();
  await call(mailPage,"/me","GET",undefined,401);
  await call(mailPage,"/auth/login","POST",{email,password},401);
  await call(mailPage,"/auth/login","POST",{email,password:newPassword});
  await call(mailPage,"/me");
  await call(mailPage,"/auth/reset-password","POST",{password},403);
  console.log("PASS V1.1 actual local registration, resend, email confirmation, PKCE password recovery and session invalidation");



 }finally{if(browser)await browser.close();await stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
