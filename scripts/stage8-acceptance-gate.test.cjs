"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {REQUIRED,evaluateEvidence,main} = require("./stage8-acceptance-gate.cjs");

const now = new Date("2026-11-20T00:00:00Z");
const stamp = "2026-11-19T12:00:00Z";
function realManifest(){
  return {checks: REQUIRED.map(x=>({id:x.id,source:x.source,evidenceRef:"reviewed-event-20261119-"+x.id,observedAt:stamp,result:"observed"}))};
}

test("absent real external acceptance remains pending even after local fixture E2E success",()=>{
 const result=evaluateEvidence({},now);
 assert.equal(result.counts.pending,6);
 assert.equal(result.canCertifyAutomatically,false);
});
test("fixtures, Mailpit and intercepted model responses cannot be substituted for real acceptance",()=>{
 const sample=realManifest();
 sample.checks[0].source="mailpit-local-only";
 sample.checks[1].source="intercepted-provider-request";
 sample.checks[2].evidenceRef="simulated-github-delivery-1";
 const result=evaluateEvidence(sample,now);
 assert.equal(result.counts.pending,3);
 assert.equal(result.counts.reviewRequired,3);
 assert.equal(result.canCertifyAutomatically,false);
});
test("an annotated proof manifest still requires independent review",()=>{
 const result=evaluateEvidence(realManifest(),now);
 assert.equal(result.counts.reviewRequired,6);
 assert.equal(result.canCertifyAutomatically,false);
});
test("stale, future, duplicate, malformed and unsafe references are rejected",()=>{
 const sample=realManifest();
 sample.checks[0].observedAt="2026-09-10T00:00:00Z";
 sample.checks[1].observedAt="2026-11-21T00:00:00Z";
 sample.checks[2].evidenceRef="https://provider.invalid/private-path";
 sample.checks[3].evidenceRef="secret@example.test";
 sample.checks.push({...sample.checks[4]});
 const result=evaluateEvidence(sample,now);
 assert.equal(result.counts.pending,5);
 assert.equal(result.counts.reviewRequired,1);
});
test("missing or invalid input never crashes or self-certifies",()=>{
 for(const x of [undefined,null,{}, {checks:{}}, {checks:[null,3,undefined]}]){
   assert.equal(evaluateEvidence(x,now).canCertifyAutomatically,false);
 }
});
test("CLI help returns zero; without evidence Stage 8 is explicitly blocked",()=>{
 const previous=console.log;
 console.log=()=>{};
 try{
   assert.equal(main(["--help"]),0);
   assert.equal(main([]),1);
 }finally{console.log=previous;}
});
