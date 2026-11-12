import { describe, expect, it, vi } from "vitest";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { appRepositoryActivity, bindingForWorkspace, parseBindings, validWebhookSignature, webhookMatchesBinding } from "./github-app";
const w="d92d765b-9b79-4fe3-a494-ae4000000001",other="d92d765b-9b79-4fe3-a494-ae4000000002";
const b={workspace_id:w,installation_id:19,repository_id:29,repository:"org/private"};
const c={appId:"99",privateKey:generateKeyPairSync("rsa",{modulusLength:2048}).privateKey.export({type:"pkcs8",format:"pem"}).toString(),bindings:JSON.stringify([b]),webhookSecret:"fixture"};
const json=(x:unknown)=>new Response(JSON.stringify(x),{status:200});
describe("GitHub App workspace access",()=>{
  it("rejects malformed and duplicate bindings",()=>{
    expect(bindingForWorkspace(c,other)).toBeUndefined();
    expect(bindingForWorkspace(c,w)).toEqual(b);
    expect(()=>parseBindings("{bad")).toThrow();
    expect(()=>parseBindings(JSON.stringify([b,{...b,workspace_id:other}]))).toThrow();
    expect(()=>parseBindings(JSON.stringify([{...b,repository:"https://evil.test/repo"}]))).toThrow();
  });
  it("never requests GitHub for an unbound workspace",async()=>{
    const f=vi.fn<typeof fetch>();
    await expect(appRepositoryActivity(c,other,"main",f)).rejects.toThrow("not authorized");
    expect(f).not.toHaveBeenCalled();
  });
  it("scopes read-only token and filters delivery history by both IDs",async()=>{
    const f=vi.fn<typeof fetch>().mockImplementation(async(input,init)=>{
      const u=String(input);
      if(u.endsWith("/access_tokens")){
        expect(JSON.parse(String(init?.body))).toEqual({repository_ids:[29],permissions:{metadata:"read",actions:"read",pull_requests:"read"}});
        return json({token:"fixture-token"});
      }
      if(u.endsWith("/repos/org/private"))return json({id:29,full_name:"org/private"});
      if(u.includes("/actions/runs?"))return json({workflow_runs:[{id:44,name:"CI",conclusion:"failure",html_url:"https://evil.test"}]});
      if(u.includes("/pulls?"))return json([{number:7,title:"Review"}]);
      if(u.includes("/hook/deliveries?"))return json([
        {id:101,installation_id:19,repository_id:29,event:"workflow_run",status_code:202},
        {id:102,installation_id:19,repository_id:30,event:"pull_request",status_code:200},
        {id:103,installation_id:20,repository_id:29,event:"pull_request",status_code:200}
      ]);
      throw Error("unexpected endpoint");
    });
    const r=await appRepositoryActivity(c,w,"main",f);
    expect(r.runs[0].html_url).toBe("https://github.com/org/private/actions/runs/44");
    expect(r.pulls[0].number).toBe(7);
    expect(r.deliveries.map(d=>d.id)).toEqual([101]);
    expect(JSON.stringify(r)).not.toContain("fixture-token");
  });
  it("stops when repository identity changes",async()=>{
    const f=vi.fn<typeof fetch>().mockResolvedValueOnce(json({token:"fixture"})).mockResolvedValueOnce(json({id:999,full_name:"org/private"}));
    await expect(appRepositoryActivity(c,w,"main",f)).rejects.toThrow("identity changed");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("authenticates raw webhook bytes and matches only authorized events",()=>{
    const raw=Buffer.from(JSON.stringify({installation:{id:19},repository:{id:29}}));
    const sig="sha256="+createHmac("sha256","fixture").update(raw).digest("hex");
    expect(validWebhookSignature(raw,sig,c.webhookSecret)).toBe(true);
    expect(validWebhookSignature(Buffer.concat([raw,Buffer.from(" ")]),sig,c.webhookSecret)).toBe(false);
    expect(validWebhookSignature(raw,sig,undefined)).toBe(false);
    expect(webhookMatchesBinding(c,"workflow_run",JSON.parse(raw.toString()))).toBe(true);
    expect(webhookMatchesBinding(c,"pull_request",{installation:{id:19},repository:{id:30}})).toBe(false);
    expect(webhookMatchesBinding(c,"push",JSON.parse(raw.toString()))).toBe(false);
  });
});
