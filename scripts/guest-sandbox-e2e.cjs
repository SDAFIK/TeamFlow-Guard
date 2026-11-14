const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const fs=require("node:fs");const path=require("node:path");
(async()=>{const browser=await chromium.launch({headless:true});try{
 const base=process.env.PLAYWRIGHT_BASE_URL||"http://127.0.0.1:3100";
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],apiCalls=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))apiCalls.push(r.url());});
 await page.goto(base+"/demo");await page.getByRole("heading",{name:"Enter sandbox instantly."}).waitFor();
 await page.getByRole("button",{name:"Start guided tour"}).click();await page.getByRole("heading",{name:"Protect the checkout release",exact:true}).waitFor();await page.getByRole("button",{name:"Inspect current risks"}).click();await page.getByRole("heading",{name:"Risk center",exact:true}).waitFor();
 await page.getByRole("button",{name:"Compare recovery",exact:true}).first().click();
 await page.getByRole("heading",{name:"Compare recovery options"}).waitFor();
 await page.getByRole("button",{name:"Create proposal",exact:true}).first().click();
 await page.getByRole("button",{name:/Open decision inbox/}).click();
 await page.getByRole("button",{name:"Approve",exact:true}).click();
 await page.getByRole("status").filter({hasText:"Approved:"}).waitFor();
 await page.getByRole("navigation",{name:"Explore sandbox"}).getByRole("button",{name:"Dependencies",exact:true}).click();
 await page.getByRole("heading",{name:"Dependency map",exact:true}).waitFor();
 await page.getByLabel("Find dependency task").selectOption({label:"AUTH-142 · Authentication API"});
 await page.getByRole("navigation",{name:"Explore sandbox"}).getByRole("button",{name:"Tasks",exact:true}).click();
 await page.getByLabel("Task title").fill("Judge-created task");await page.getByRole("button",{name:"Add task",exact:true}).click();await page.getByText("Judge-created task",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Reset sandbox",exact:true}).click();await page.getByRole("button",{name:"Confirm reset",exact:true}).click();
 await page.getByRole("navigation",{name:"Explore sandbox"}).getByRole("button",{name:"Tasks",exact:true}).click();assert.equal(await page.getByText("Judge-created task",{exact:true}).count(),0);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:844});for(const tab of ["Overview","Risks","Dependencies","Recovery","Decisions","Tasks","Team","Audit"]){await page.getByRole("navigation",{name:"Explore sandbox"}).getByRole("button",{name:tab,exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),tab+" overflow at "+width);}}
 if(process.env.TEAMFLOW_GUEST_ARTIFACT_DIR){
  const dir=process.env.TEAMFLOW_GUEST_ARTIFACT_DIR;fs.mkdirSync(dir,{recursive:true});
  for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});for(const tab of ["Overview","Risks","Dependencies","Recovery","Decisions","Tasks","Team","Audit"]){await page.getByRole("navigation",{name:"Explore sandbox"}).getByRole("button",{name:tab,exact:true}).click();await page.screenshot({path:path.join(dir,"guest-"+width+"-"+tab.toLowerCase()+".png"),fullPage:true});}}
 }
 assert.deepEqual(apiCalls,[],"guest must make no application API requests");assert.deepEqual(errors,[]);
 const entry=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});await entry.goto(base+"/login");await entry.getByRole("link",{name:"Try Live Demo — No Sign-up"}).click();await entry.getByRole("heading",{name:"Enter sandbox instantly."}).waitFor();assert.equal(await entry.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const other=await browser.newPage();await other.goto(base+"/demo");await other.getByRole("heading",{name:"Enter sandbox instantly."}).waitFor();assert.equal(await other.getByText("Judge-created task",{exact:true}).count(),0);
 console.log("PASS guest instant entry, recovery approval, graph, editing, reset, isolation and responsive route sweep");
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
