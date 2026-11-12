/* Browser-level UX checks against an isolated, explicitly simulated API.
 * No live credentials or persistent workspace mutations are used here.
 * For real Supabase/API acceptance, run the separate hosted journey tests.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const OWNER = "be88714b-5076-4d28-a261-a99000000001";
const OTHER = "be88714b-5076-4d28-a261-a99000000002";
const WORKSPACE = "d92d765b-9b79-4fe3-a494-ae4000000001";
const firstTask = {
  id: "6cf69563-82e6-49a4-9cf7-a04000000001", key: "APP-101",
  title: "Plan the first sprint", description: "Agree on scope with the team",
  status: "todo", owner_id: OWNER, position: 1, version: 1,
  reviewer_id: null, priority: "normal", estimate_hours: 8, due_at: null,
};

function model(role) {
  const store = {
    role, version: 1, tasks: [firstTask], edges: [], proposals: [], audit: [{id:"mock-audit-1",actor_id:OWNER,actor_name:"Asha (mock)",kind:"workspace.created",summary:"Workspace created (simulated)",created_at:new Date().toISOString(),plan_version:1,changes:[]}], githubRepo:null,
    members: [
      {id:OWNER,name:"Asha (mock)",email:"asha@example.invalid",role:role==="viewer"?"viewer":"lead",specialty:"Product",available_hours:24},
      {id:OTHER,name:"Jin (mock)",email:"jin@example.invalid",role:"contributor",specialty:"Frontend",available_hours:20},
    ],
    invites: [{id:"expired-fixture",email:"expired.person@example.invalid",role:"member",expires_at:new Date(Date.now()-86400000).toISOString(),accepted_at:null,revoked_at:null}], emailRequests:[], settings: {
      id: WORKSPACE, name: "Sample UX workspace", description: "Isolated browser fixture",
      tracked_branch: "main", review_threshold_hours: 24, plan_version: 1,
      my_role: role === "viewer" ? "viewer" : "owner", invitation_email_configured:role!=="viewer",
    },
  };
  return store;
}

async function mockApi(page, state) {
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    const input = ["POST", "PATCH", "PUT"].includes(method) ? request.postDataJSON() : {};
    const json = (data, status=200) => route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
    const base = `/api/projects/${WORKSPACE}`;
    if (pathname === "/api/me") return json({id:OWNER,name:"Asha (mock)",email:"asha@example.invalid"});
    if (pathname === "/api/projects" && method==="GET") return json([{id:WORKSPACE,name:state.settings.name,role:state.role}]);
    if (pathname === `${base}/dashboard`) return json({
      project:{id:WORKSPACE,name:state.settings.name,role:state.role},
      description:state.settings.description,is_demo:false,fixture_label:"",
      plan_version:state.version,as_of:new Date().toISOString(),
      tasks:state.tasks,members:state.members,
      counts:{total:state.tasks.length,...Object.fromEntries(["todo","in_progress","blocked","done"].map(s=>[s,state.tasks.filter(t=>t.status===s).length]))},
    });
    if (pathname === `${base}/dependencies`) return json({
      nodes:state.tasks,edges:state.edges,plan_version:state.version,
      selected_task_id:url.searchParams.get("selected"),downstream_ids:[],upstream_ids:[],
    });
    if (pathname === `${base}/risks`) return json([]);
    if (pathname === `${base}/proposals` && method==="GET") return json(state.proposals);
    if (pathname === `${base}/audit`) return json(state.audit);
    if (pathname === `${base}/integrations`) return json({
      ai_configured:false,ai_provider:"gemini",ai_model:null,github_configured:false,mode:"manual",
    });
    if (pathname === `${base}/settings` && method==="GET") return json({
      ...state.settings,plan_version:state.version,members:state.members.map(m=>({...m,role:m.id===OWNER?state.settings.my_role:"member"})),
    });
    if (pathname === `${base}/github-readiness` && method==="GET") return json({repository:state.githubRepo,app_bound:false,app_credentials:false,webhook_configured:false,ingestion_configured:false,mappings:[],tracked_branch:"main",email_configured:state.settings.invitation_email_configured,is_demo:false});
    if (pathname === `${base}/github` && method==="GET" && state.role==="viewer") return json({connected:true,repository:"fixture/private-repo",mode:"app",runs:[],warning:null,pulls:[{number:7,title:"Private PR (simulated)",draft:false,updated_at:new Date().toISOString(),html_url:"https://github.com/fixture/private-repo/pull/7"}],deliveries:[{id:1,event:"workflow_run",action:"completed",status_code:202,delivered_at:new Date().toISOString()}],observed_at:new Date().toISOString()});
    if (pathname === `${base}/github` && method==="GET") return json({
      connected:!!state.githubRepo,repository:state.githubRepo,warning:null,
      runs:state.githubRepo?[{id:99,name:"Validation (simulated)",status:"completed",conclusion:"success",html_url:`https://github.com/${state.githubRepo}/actions/runs/99`,created_at:"2026-11-10T12:00:00Z"}]:[],
    });
    if (pathname === `${base}/github` && method==="POST") {
      if (state.role === "viewer") return json({message:"Manager access required"},403);
      state.githubRepo=input.repository?.replace("https://github.com/", "") ?? null;
      state.version++;
      return json({repository:state.githubRepo,plan_version:state.version});
    }
    if (pathname === `${base}/settings` && method==="PUT") {
      if (state.role==="viewer") return json({message:"Manager access required"},403);
      Object.assign(state.settings,input);
      return json({message:"saved"});
    }
    if (pathname === `${base}/invitations` && method==="GET") return json(state.invites);
    if (pathname === `${base}/invitations` && method==="POST") {
      if(state.role==="viewer") return json({message:"Manager access required"},403);
      const invitation={id:"mock-invite-"+state.invites.length,email:input.email,role:input.role,expires_at:new Date(Date.now()+7*86400000).toISOString(),accepted_at:null,revoked_at:null};
      state.invites.push(invitation);
      if(input.send_email) state.emailRequests.push(input.email);
      return json({...invitation,token:state.invites.length.toString(16).padStart(64,"a"),email_status:input.send_email?"accepted":"not_requested"});
    }
    if (pathname === `${base}/tasks` && method==="POST") {
      if (state.role==="viewer") return json({message:"Read-only access"},403);
      const task={...firstTask,...input,id:"6cf69563-82e6-49a4-9cf7-a04000000002",status:"todo",position:state.tasks.length+1,version:1,reviewer_id:null,priority:"normal"};
      state.tasks.push(task);state.version++;
      return json(task);
    }
    if (pathname === `${base}/dependencies/validate` && method==="POST") return json({message:"valid"});
    if (pathname === `${base}/proposals` && method==="POST") {
      if (state.role==="viewer") return json({message:"Read-only access"},403);
      state.proposals.push({id:"b4187604-f837-4f11-b0bd-575000000001",title:input.title,status:"pending",stale:false,actions:input.actions,base_plan_version:input.base_plan_version,created_at:new Date().toISOString()});
      return json(state.proposals.at(-1));
    }
    if (pathname === `${base}/members/${OTHER}/role` && method==="PUT") {
      return json({message:"updated"});
    }
    return json({message:`Missing simulated endpoint: ${method} ${pathname}`},404);
  });
}

async function run(viewport, role="lead") {
  const label = `${viewport.width}px-${role}`;
  const browser = await chromium.launch({
    headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE} : {}),
    args:["--no-sandbox"],
  });
  const page = await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:"reduce"});
  const failures=[];
  page.on("pageerror",error=>failures.push(error.message));
  const state=model(role);
  try {
    await mockApi(page,state);
    await page.goto(`${BASE}/overview`,{waitUntil:"networkidle"});
    await page.getByRole("heading",{name:"Delivery overview"}).waitFor();
    await page.getByRole("region",{name:"Your next action"}).waitFor();
    await page.getByRole("progressbar",{name:"Completed tasks"}).waitFor();
    await page.getByRole("region",{name:"TeamFlow Guard brand hero"}).waitFor();
    await page.getByRole("region",{name:"TeamFlow Guard brand hero"}).getByText("See risks early. Keep humans in control.",{exact:true}).waitFor();
    await page.getByRole("region",{name:"Workspace connection shortcuts"}).getByRole("button",{name:/Connect your team/}).waitFor();
    await page.getByRole("region",{name:"Workspace connection shortcuts"}).getByRole("button",{name:/Connect GitHub project/}).waitFor();
    await page.getByRole("button",{name:"Recent team activity",exact:true}).click();
    await page.getByRole("dialog",{name:"Recent team activity"}).getByText("Workspace created (simulated)").waitFor();
    await page.getByRole("button",{name:"Close activity",exact:true}).click();

    if (viewport.width<600) await page.getByRole("button",{name:"Open navigation"}).click();
    await page.getByRole("button",{name:"Risk Center",exact:true}).click();
    await page.getByRole("region",{name:"Risk protection overview"}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false,"risk overview has no overflow");
    if (viewport.width<600) await page.getByRole("button",{name:"Open navigation"}).click();
    await page.getByRole("button",{name:"Task Board",exact:true}).click();
    if (role==="lead") {
      await page.getByRole("button",{name:"Create task",exact:true}).first().click();
      await page.getByRole("dialog",{name:"Create a task"}).waitFor();
      await page.getByLabel("Task title").fill("Ship the shared dashboard");
      await page.getByRole("dialog").getByRole("button",{name:"Create task"}).click();
      await page.getByText("Ship the shared dashboard").first().waitFor();
      await page.reload({waitUntil:"networkidle"});
      await page.getByText("Ship the shared dashboard").first().waitFor();
      assert.equal(state.tasks.length,2,"task persisted across simulated reload");
    } else {
      assert.equal(await page.getByRole("button",{name:"Create task",exact:true}).count(),0,"viewer has no write entrypoint");
    }

    if (viewport.width<600) await page.getByRole("button",{name:"Open navigation"}).click();
    await page.getByRole("button",{name:"Dependencies",exact:true}).click();
    await page.getByRole("heading",{name:"Dependency map"}).waitFor();
    const taskSelect=page.getByRole("combobox",{name:"Find dependency task"});
    await taskSelect.selectOption(state.tasks[0].id);
    await page.getByRole("button",{name:"Open task",exact:true}).waitFor();
    await page.getByRole("button",{name:"Fit all",exact:true}).click();
    await page.getByRole("button",{name:"Reset layout",exact:true}).click();
    await taskSelect.selectOption("");
    if(role==="lead") {
      await page.getByRole("button",{name:"Propose dependency"}).click();
      await page.getByRole("dialog",{name:"Propose a dependency"}).waitFor();
      await page.getByRole("dialog").getByRole("button",{name:"Validate & create proposal"}).click();
      await page.getByRole("dialog",{name:"Propose a dependency"}).waitFor({state:"hidden"});
      assert.equal(state.proposals.length,1,"dependency proposal recorded, not auto-approved");
      assert.equal(state.edges.length,0,"dependency edges unchanged pending approval");
    } else {
      assert.equal(await page.getByRole("button",{name:"Propose dependency"}).isDisabled(),true,"viewer cannot propose");
    }

    if (viewport.width<600) await page.getByRole("button",{name:"Open navigation"}).click();
    await page.getByRole("button",{name:"Team & invitations",exact:true}).first().click();
    await page.getByRole("heading",{name:"Your team",exact:true}).waitFor();
    await page.getByRole("region",{name:"Integration readiness"}).getByText("Repository authorization",{exact:true}).waitFor();
    await page.getByRole("searchbox",{name:"Search team members"}).fill("Jin");
    await page.locator(".settings-member-list").getByText("Jin (mock)",{exact:true}).waitFor();
    assert.equal(await page.locator(".settings-member-list").getByText("Asha (mock)",{exact:true}).count(),0);
    await page.getByRole("searchbox",{name:"Search team members"}).fill("");
    if(role==="lead") {
      await page.getByLabel("Teammate email").fill("new.person@example.invalid");
      await page.getByRole("button",{name:"Generate invitation link"}).click();
      await page.getByRole("textbox",{name:"Private invitation link"}).waitFor();
      const emailDraft = page.getByRole("link",{name:"Open email draft"});
      assert.match(await emailDraft.getAttribute("href"),/^mailto:/,"invitation offers a real email draft");
      await page.getByRole("button",{name:"Renew invitation",exact:true}).click();
      assert.equal(await page.getByLabel("Teammate email").inputValue(),"expired.person@example.invalid");
      await page.getByRole("checkbox",{name:"Send invitation email now"}).check();
      await page.getByRole("button",{name:"Generate invitation link",exact:true}).click();
      await page.getByText("Invitation accepted by the email provider. Delivery to the inbox is not yet confirmed.",{exact:true}).waitFor();
      assert.deepEqual(state.emailRequests,["expired.person@example.invalid"],"only explicitly requested simulated email");
      await page.getByLabel("Repository URL or owner/name").fill("SDAFIK/TeamFlow-Guard");
      await page.getByRole("button",{name:"Link repository"}).click();
      await page.getByText("Public GitHub repository linked",{exact:true}).waitFor();
      await page.getByText("Validation (simulated)").waitFor();
      assert.equal(state.githubRepo,"SDAFIK/TeamFlow-Guard","GitHub link persisted in the simulated workspace");
    } else {
      assert.equal(await page.getByRole("button",{name:"Generate invitation link"}).count(),0,"viewer cannot invite");
      assert.equal(await page.getByRole("button",{name:"Link repository"}).count(),0,"viewer cannot link repositories");
      await page.getByText("GitHub App repository configured",{exact:true}).waitFor();
      await page.getByText("#7 Private PR (simulated)",{exact:true}).waitFor();
      await page.getByText("workflow run · completed",{exact:true}).waitFor();
      assert.equal(await page.getByRole("checkbox",{name:"Send invitation email now"}).count(),0,"viewer cannot send invitations");
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    assert.equal(overflow,false,`horizontal overflow at ${label}`);
    assert.deepEqual(failures,[],`client errors at ${label}`);
    fs.mkdirSync("evidence",{recursive:true});
    await page.screenshot({path:path.join("evidence",`ux-mock-${label}.png`),fullPage:true});
    console.log(`PASS ${label}: simulated tasks, dependencies, email invites, public GitHub link and team permissions; no overflow or page errors`);
  } finally {await browser.close();}
}

(async()=>{
  await run({width:1440,height:900},"lead");
  await run({width:390,height:844},"lead");
  await run({width:390,height:844},"viewer");
})().catch(error=>{console.error(error);process.exitCode=1;});
