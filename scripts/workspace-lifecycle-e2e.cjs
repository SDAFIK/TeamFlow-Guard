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
 }finally{if(browser)await browser.close();await stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
