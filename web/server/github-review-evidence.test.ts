import { beforeEach,afterEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn(),observe:vi.fn()}));
vi.mock("@supabase/supabase-js",()=>({createClient:()=>({rpc:mocks.rpc})}));
vi.mock("./github-app",async importOriginal=>({...await importOriginal<typeof import("./github-app")>(),appReviewObservation:mocks.observe}));
import { mappedReviewEvent,reconcileReview } from "./github-review-evidence";
import { POST } from "../app/api/github/webhook/route";
import { createHmac } from "node:crypto";
const w="d92d765b-9b79-4fe3-a494-ae4000000001",t="6cf69563-82e6-49a4-9cf7-a04000000001",r="11111111-1111-4111-8111-111111111111";
const mapping={workspace_id:w,pull_number:7,task_id:t,github_reviewer_id:12,reviewer_id:r};
const binding={workspace_id:w,installation_id:19,repository_id:29,repository:"org/private"};
const config={bindings:JSON.stringify([binding]),webhookSecret:"fixture"};
const payload={action:"review_requested",installation:{id:19},repository:{id:29,full_name:"org/private"},pull_request:{number:7}};
const delivery="d92d765b-9b79-4fe3-a494-ae4000000002";
const observation={target_branch:"main",status:"waiting",review_requested_at:"2026-11-12T00:00:00Z",observed_at:"2026-11-13T00:00:00Z",pr_state:"open",is_draft:false};
const event=mappedReviewEvent(config,JSON.stringify([mapping]),"pull_request",payload)!;
function request(body:unknown,type="pull_request",signature?:string,deliveryId=delivery){
  const raw=JSON.stringify(body);
  return new Request("https://example.invalid/api/github/webhook",{method:"POST",body:raw,headers:{"x-github-event":type,"x-github-delivery":deliveryId,"x-hub-signature-256":signature??"sha256="+createHmac("sha256","fixture").update(raw).digest("hex")}});
}
beforeEach(()=>{
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.invalid");vi.stubEnv("TEAMFLOW_GITHUB_INGEST_KEY","test-only");
  vi.stubEnv("TEAMFLOW_GITHUB_APP_BINDINGS",config.bindings);vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET","fixture");
  vi.stubEnv("TEAMFLOW_GITHUB_REVIEW_MAPPINGS",JSON.stringify([mapping]));
  mocks.rpc.mockReset();mocks.observe.mockReset();
  mocks.rpc.mockImplementation(async(name:string)=>({error:null,data:name==="tf_github_mapping_list"?{ci:[],reviews:[]}:name==="tf_github_review_context"?"main":{status:"recorded"}}));
  mocks.observe.mockResolvedValue(observation);
});
afterEach(()=>vi.unstubAllEnvs());
it("maps only authorized repository/installation/PR and supported lifecycle",()=>{
  expect(event.mapping).toEqual(mapping);
  expect(mappedReviewEvent(config,JSON.stringify([mapping]),"pull_request_review",{...payload,action:"submitted"})?.mapping).toEqual(mapping);
  for(const p of [{...payload,repository:{id:29,full_name:"wrong/repo"}},{...payload,installation:{id:20}},{...payload,pull_request:{number:8}},{...payload,action:"labeled"}])expect(mappedReviewEvent(config,JSON.stringify([mapping]),"pull_request",p)).toBeNull();
});
it("authenticates raw webhook, reads server context, reconciles current GitHub state and persists normalized evidence",async()=>{
  expect((await POST(request(payload))).status).toBe(202);
  expect(mocks.rpc).toHaveBeenNthCalledWith(1,"tf_github_review_context",{w,t,reviewer:r});
  expect(mocks.observe).toHaveBeenCalledWith(expect.objectContaining({bindings:config.bindings}),w,"main",mapping);
  expect(mocks.rpc).toHaveBeenNthCalledWith(2,"tf_ingest_github_review",expect.objectContaining({w,t,reviewer:r,delivery_id:delivery,review_status:"waiting",requested:observation.review_requested_at,repo:"org/private",branch:"main"}));
});
it("reconciles review submission rather than inferring resolution from its payload",async()=>{
  mocks.observe.mockResolvedValue({...observation,status:"not_requested",review_requested_at:null});
  expect((await POST(request({...payload,action:"submitted"},"pull_request_review"))).status).toBe(202);
  expect(mocks.rpc).toHaveBeenLastCalledWith("tf_ingest_github_review",expect.objectContaining({review_status:"not_requested",requested:null}));
});
it("rejects tampering, invalid delivery and unrelated PR before network calls",async()=>{
  expect((await POST(request(payload,"pull_request","sha256="+"0".repeat(64)))).status).toBe(401);
  expect((await POST(request(payload,"pull_request",undefined,"bad"))).status).toBe(400);
  expect((await POST(request({...payload,pull_request:{number:8}}))).status).toBe(204);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("tf_github_mapping_list",{w,repo:"org/private",installation:19,repository:29});expect(mocks.observe).not.toHaveBeenCalled();
});
it("fails closed when context, GitHub or persistence is unavailable",async()=>{
  mocks.rpc.mockResolvedValueOnce({error:{message:"unavailable"},data:null});
  await expect(reconcileReview(config,event,delivery)).rejects.toThrow("mapping unavailable");
  expect(mocks.observe).not.toHaveBeenCalled();
  mocks.observe.mockRejectedValueOnce(Error("GitHub unavailable"));
  expect((await POST(request(payload))).status).toBe(503);
  mocks.rpc.mockImplementation(async(name:string)=>name==="tf_github_review_context"?{error:null,data:"main"}:{error:{message:"database unavailable"}});
  expect((await POST(request(payload))).status).toBe(503);
});
