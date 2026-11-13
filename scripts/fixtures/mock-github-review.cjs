/* Test-only Node preload. Intercepts GitHub HTTP in an isolated local acceptance subprocess.
 * No production configuration, actual GitHub token or external provider call is used.
 */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const fixture=process.env.TEAMFLOW_TEST_GITHUB_FIXTURE;
if(fixture){
  const local=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||"http://invalid");
  assert.ok(local.protocol==="http:"&&["localhost","127.0.0.1"].includes(local.hostname)&&local.port==="54321","Review fixture refuses hosted Supabase");
  const original=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
    const u=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    // Simulated Gemini HTTP transport is restricted to local Supabase and a fake key.
    if(u.hostname==="generativelanguage.googleapis.com"){
      assert.equal(process.env.GEMINI_API_KEY,"teamflow-local-fixture-key");
      assert.match(u.pathname,/:generateContent$/);
      const request=typeof init?.body==="string"?JSON.parse(init.body):await input.json();
      const context=JSON.parse(request.contents.flatMap(c=>c.parts||[]).find(p=>typeof p.text==="string").text);
      assert.ok(context.evidence?.[0]?.id&&context.candidates?.length>0);
      const candidate={title:"Fixture Gemini recovery",explanation:"Prioritize investigation of the fictional CI failure. Human approval is required.",evidence_ids:[context.evidence[0].id],action_indices:[0],assumptions:["Fictional input; no delivery guarantee."],requires_human_approval:true};
      return Response.json({candidates:[{content:{role:"model",parts:[{text:JSON.stringify(candidate)}]},finishReason:"STOP"}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:25,totalTokenCount:45}});
    }
    if(u.hostname!=="api.github.com")return original(input,init);
    assert.equal(u.protocol,"https:");
    const state=JSON.parse(fs.readFileSync(fixture,"utf8"));
    const headers=new Headers(init?.headers??(typeof input==="object"&&"headers" in input?input.headers:undefined));
    const json=value=>Response.json(value);
    if(u.pathname==="/app/installations/101/access_tokens"){
      assert.equal(init?.method,"POST");
      assert.match(headers.get("authorization")||"",/^Bearer [^.]+\.[^.]+\.[^.]+$/);
      const body=JSON.parse(String(init.body));
      assert.deepEqual(body.repository_ids,[202]);assert.equal(body.permissions.metadata,"read");assert.equal(body.permissions.pull_requests,"read");
      assert.ok(!Object.values(body.permissions).includes("write"));
      return json({token:"fictional-scoped-token"});
    }
    if(u.pathname==="/app/hook/deliveries")return json([]);
    assert.equal(headers.get("authorization"),"Bearer fictional-scoped-token");
    if(u.pathname==="/repos/fixture/isolated")return json({id:202,full_name:"fixture/isolated"});
    if(u.pathname==="/repos/fixture/isolated/actions/workflows")return json({workflows:[{id:303,name:"Existing CI",state:"active"},{id:404,name:"New CI",state:"active"}]});
    const secondPull={number:8,title:"Second fictional PR",state:"open",draft:false,updated_at:"2026-11-12T00:00:00Z",base:{ref:"main",repo:{id:202}},requested_reviewers:[{id:124,login:"fixture-reviewer"}]};
    if(u.pathname==="/repos/fixture/isolated/pulls/8")return json(secondPull);
    if(u.pathname==="/repos/fixture/isolated/issues/8/timeline")return json([{event:"review_requested",created_at:"2026-11-11T00:00:00Z",requested_reviewer:{id:124}}]);
    if(u.pathname==="/repos/fixture/isolated/pulls/7")return json(state.pull);
    if(u.pathname==="/repos/fixture/isolated/issues/7/timeline")return json(state.timeline);
    if(u.pathname==="/repos/fixture/isolated/pulls")return json([state.pull,secondPull]);
    if(u.pathname==="/repos/fixture/isolated/actions/runs")return json({workflow_runs:[]});
    throw Error("Unexpected GitHub fixture endpoint "+u.pathname);
  };
}
