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
    if(u.pathname==="/repos/fixture/isolated/pulls/7")return json(state.pull);
    if(u.pathname==="/repos/fixture/isolated/issues/7/timeline")return json(state.timeline);
    if(u.pathname==="/repos/fixture/isolated/pulls")return json([state.pull]);
    if(u.pathname==="/repos/fixture/isolated/actions/runs")return json({workflow_runs:[]});
    throw Error("Unexpected GitHub fixture endpoint "+u.pathname);
  };
}
