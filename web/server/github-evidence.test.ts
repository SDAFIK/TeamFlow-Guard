import { describe, expect, it } from "vitest";
import { mappedCI } from "./github-evidence";
const w="d92d765b-9b79-4fe3-a494-ae4000000001", t="6cf69563-82e6-49a4-9cf7-a04000000001";
const c={bindings:JSON.stringify([{workspace_id:w,installation_id:19,repository_id:29,repository:"org/private"}])};
const mapping=JSON.stringify([{workspace_id:w,workflow_id:9,task_id:t}]);
const payload={action:"completed",installation:{id:19},repository:{id:29,full_name:"org/private"},workflow_run:{id:44,workflow_id:9,run_attempt:1,head_branch:"main",status:"completed",conclusion:"failure",updated_at:"2026-11-12T07:00:00Z"}};
describe("CI evidence mapping",()=>{
 it("maps a completed signed-event payload to the configured task",()=>{expect(mappedCI(c,mapping,"workflow_run",payload)).toMatchObject({w,t,run_id:44,workflow_id:9,conclusion:"failure"});});
 it("ignores unmatched installation, repository, workflow and noncompleted events",()=>{
  expect(mappedCI(c,mapping,"workflow_run",{...payload,installation:{id:20}})).toBeNull();
  expect(mappedCI(c,mapping,"workflow_run",{...payload,repository:{id:30,full_name:"org/private"}})).toBeNull();
  expect(mappedCI(c,mapping,"workflow_run",{...payload,workflow_run:{...payload.workflow_run,workflow_id:10}})).toBeNull();
  expect(mappedCI(c,mapping,"pull_request",payload)).toBeNull();
 });
 it("does not fabricate evidence for canceled checks or duplicate mappings",()=>{
  expect(mappedCI(c,mapping,"workflow_run",{...payload,workflow_run:{...payload.workflow_run,conclusion:"cancelled"}})).toBeNull();
  expect(()=>mappedCI(c,JSON.stringify([...JSON.parse(mapping),...JSON.parse(mapping)]),"workflow_run",payload)).toThrow();
 });
});