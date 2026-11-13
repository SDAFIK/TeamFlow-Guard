import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "../app/api/github/webhook/route";
const w="d92d765b-9b79-4fe3-a494-ae4000000001", t="6cf69563-82e6-49a4-9cf7-a04000000001";
const secret="isolated-test-secret";
const payload={action:"completed",installation:{id:19},repository:{id:29,full_name:"org/private"},workflow_run:{id:44,workflow_id:9,run_attempt:1,head_branch:"main",status:"completed",conclusion:"failure",updated_at:"2026-11-12T07:00:00Z"}};
function request(body: unknown, event="workflow_run", signature?:string) {
  const raw=typeof body==="string"?body:JSON.stringify(body);
  const sig=signature??"sha256="+createHmac("sha256",secret).update(raw).digest("hex");
  return new Request("https://example.invalid/api/github/webhook",{method:"POST",body:raw,headers:{"x-github-event":event,"x-hub-signature-256":sig}});
}
beforeEach(()=>{
  vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET",secret);
  vi.stubEnv("TEAMFLOW_GITHUB_APP_BINDINGS",JSON.stringify([{workspace_id:w,installation_id:19,repository_id:29,repository:"org/private"}]));
  vi.stubEnv("TEAMFLOW_GITHUB_CI_MAPPINGS",JSON.stringify([{workspace_id:w,workflow_id:9,task_id:t}]));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.invalid");
  vi.stubEnv("TEAMFLOW_GITHUB_INGEST_KEY","test-only");
  mocks.rpc.mockReset();mocks.rpc.mockImplementation(async(name)=>name==="tf_github_mapping_list"?{data:{ci:[],reviews:[]},error:null}:{error:null});
});
afterEach(()=>vi.unstubAllEnvs());
describe("GitHub webhook receiver boundary",()=>{
  it("accepts signed mapped failure and passes only normalized evidence to persistence",async()=>{
    expect((await POST(request(payload))).status).toBe(202);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("tf_ingest_github_ci",{w,t,repo:"org/private",workflow_id:9,run_id:44,attempt:1,branch:"main",conclusion:"failure",observed:"2026-11-12T07:00:00Z"});
  });
  it("accepts a passing retry without inventing a task mutation",async()=>{
    expect((await POST(request({...payload,workflow_run:{...payload.workflow_run,run_attempt:2,conclusion:"success"}}))).status).toBe(202);
    expect(mocks.rpc).toHaveBeenCalledWith("tf_ingest_github_ci",expect.objectContaining({attempt:2,conclusion:"success"}));
  });
  it("rejects tampered bodies and missing configuration",async()=>{
    expect((await POST(request(payload,"workflow_run","sha256="+"0".repeat(64)))).status).toBe(401);
    vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET","");
    expect((await POST(request(payload))).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("ignores unauthorized repository and unmapped workflow",async()=>{
    expect((await POST(request({...payload,repository:{id:30,full_name:"org/private"}}))).status).toBe(204);
    expect((await POST(request({...payload,workflow_run:{...payload.workflow_run,workflow_id:99}}))).status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("tf_github_mapping_list",{w,repo:"org/private",installation:19,repository:29});
  });
  it("accepts a workspace-managed workflow mapping from storage",async()=>{
    mocks.rpc.mockImplementation(async(name)=>name==="tf_github_mapping_list"?{data:{ci:[{workspace_id:w,workflow_id:99,task_id:t}],reviews:[]},error:null}:{error:null});
    expect((await POST(request({...payload,workflow_run:{...payload.workflow_run,workflow_id:99}}))).status).toBe(202);
    expect(mocks.rpc).toHaveBeenCalledWith("tf_ingest_github_ci",expect.objectContaining({w,t,workflow_id:99}));
  });
  it("rejects malformed signed JSON and oversized request",async()=>{
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request("x".repeat(1048577)))).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports persistence failure instead of acknowledging evidence",async()=>{
    mocks.rpc.mockResolvedValue({error:{message:"database unavailable"}});
    expect((await POST(request(payload))).status).toBe(503);
  });
  it("acknowledges signed ping without persistence",async()=>{
    expect((await POST(request({},"ping"))).status).toBe(204);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
