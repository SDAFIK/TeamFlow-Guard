// Operator-only fixture preparation. Passwords never enter source or command output.
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import bcrypt from "../web/node_modules/bcryptjs/index.js";
mkdirSync(".local", { recursive: true });
const file = ".local/hosted-demo.json";
const people = [["Asha","owner","Product & delivery"],["Rahim","member","Backend engineering"],["Nila","member","Auth & frontend"],["Arif","member","Checkout experience"],["Sami","manager","Quality assurance"],["Jordan","viewer","Demo evaluator"]];
let fixture;
if (existsSync(file)) fixture = JSON.parse(readFileSync(file,"utf8"));
else {
  fixture = { project_id: "iqsbbmwwayepeqwuxscg", workspace: randomUUID(), password: randomBytes(24).toString("base64url"), people: Object.fromEntries(people.map(([name]) => [name,randomUUID()])), tasks: Object.fromEntries(["AUTH-142","LOGIN-210","CHK-318","PAY-104","QA-105","REL-106","CAT-107"].map(key=>[key,randomUUID()])) };
  writeFileSync(file,JSON.stringify(fixture,null,2));
}
if (fixture.project_id !== "iqsbbmwwayepeqwuxscg") throw new Error("Unexpected hosted target");
if (process.argv.includes('--new-workspace')) {
  writeFileSync(`.local/hosted-demo-${fixture.workspace}.json`,JSON.stringify(fixture,null,2));
  fixture.workspace=randomUUID();
  fixture.tasks=Object.fromEntries(Object.keys(fixture.tasks).map(key=>[key,randomUUID()]));
  writeFileSync(file,JSON.stringify(fixture,null,2));
}
const quote = v => "'"+String(v).replaceAll("'","''")+"'";
const w = quote(fixture.workspace);
const sql = ["begin;", `insert into public.tf_workspaces(id,name,description,is_demo,fixture_label) values(${w},'Checkout Launch','A six-person fictional release workspace.',true,'Sample sprint · fictional evidence') on conflict do nothing;`];
for (const [name,role,specialty] of people) {
  const id = quote(fixture.people[name]), email = quote(name.toLowerCase()+"@teamflow.demo");
  const hash = quote(await bcrypt.hash(fixture.passwords?.[name.toLowerCase()+"@teamflow.demo"] ?? fixture.password,12));
  sql.push(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000',${id},'authenticated','authenticated',${email},${hash},now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now()) on conflict(id) do nothing;`);
  sql.push(`insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${id},${id},jsonb_build_object('sub',${id},'email',${email},'email_verified',true),'email',now(),now()) on conflict(provider_id,provider) do nothing;`);
  sql.push(`insert into public.tf_memberships(workspace_id,user_id,role,name,email,specialty,available_hours,availability_start,availability_end) values(${w},${id},${quote(role)},${quote(name)},${email},${quote(specialty)},${name==='Nila'?4:40},now(),now()+interval '2 days') on conflict do nothing;`);
}
const rows = [["AUTH-142","Auth API","Rahim","blocked"],["LOGIN-210","Login UI","Nila","in_progress"],["CHK-318","Checkout UI","Arif","todo"],["PAY-104","Payment tests","Sami","todo"],["QA-105","QA pass","Sami","todo"],["REL-106","Friday release","Asha","todo"],["CAT-107","Catalog UI","Nila","in_progress"]];
rows.forEach(([key,title,owner,status],position)=>sql.push(`insert into public.tf_tasks(id,workspace_id,key,title,description,owner_id,status,position,due_at) values(${quote(fixture.tasks[key])},${w},${quote(key)},${quote(title)},'Fictional demo task.',${quote(fixture.people[owner])},${quote(status)},${position},now()+interval '5 days') on conflict do nothing;`));
for(let i=0;i<5;i++) sql.push(`insert into public.tf_dependencies values(${w},${quote(fixture.tasks[rows[i][0]])},${quote(fixture.tasks[rows[i+1][0]])}) on conflict do nothing;`);
for (const [kind,key,title,detail,payload] of [
  ["ci_failure","AUTH-142","ci_921 · Auth CI failed","Seeded failed release-branch CI #921; not connected GitHub data.","jsonb_build_object('branch','main','tracked_branch','main','conclusion','failure')"],
  ["dependency","AUTH-142","Auth API is blocked","Seeded explicit blocker propagates through Login and Checkout.","'{}'::jsonb"],
  ["review_delay","AUTH-142","pr_87 · review pending","Seeded open non-draft PR awaiting review for 48 hours.",`jsonb_build_object('state','open','is_draft',false,'reviewer_id',${quote(fixture.people.Sami)},'review_requested_at',now()-interval '48 hours')`],
  ["capacity","LOGIN-210","Voluntary 50% availability","Fictional Nila voluntarily reports four of eight planning hours for two days. No private reason is stored.","'{}'::jsonb"],
]) sql.push(`insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin,payload) values(${w},${quote(fixture.tasks[key])},${quote('seed:'+kind)},${quote(kind)},${quote(title)},${quote(detail)},'seed',${payload}) on conflict do nothing;`);
sql.push("commit;");
writeFileSync(".local/hosted-demo.sql",sql.join("\n"));
writeFileSync(".local/HOSTED_DEMO_LOGIN.txt",`Hosted isolated fictional workspace\nManager: asha@teamflow.demo\nViewer: jordan@teamflow.demo\nManager password: ${fixture.passwords?.["asha@teamflow.demo"] ?? fixture.password}\nViewer password: ${fixture.passwords?.["jordan@teamflow.demo"] ?? fixture.password}\nNever commit this file.\n`);
console.log("Prepared isolated six-person hosted fixture. Credentials saved privately in .local/HOSTED_DEMO_LOGIN.txt.");
