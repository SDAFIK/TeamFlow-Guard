import {it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {generateRecovery} from "./recovery-provider";
const id="11111111-1111-4111-8111-111111111111";
it.skipIf(process.env.TEAMFLOW_GEMINI_LIVE_SMOKE!=="1"||process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!=="codex/gemini-live-smoke")("calls actual Gemini with synthetic recovery evidence only",async()=>{
 const context={risk:"Fictional sample: CI failed and blocks checkout.",task:{id:"22222222-2222-4222-8222-222222222222",key:"DEMO-1",title:"Sample payment test"},evidence:[{id,title:"Synthetic CI failure",detail:"Fictional build failed one test.",origin:"seed"}],candidates:[{task_id:"22222222-2222-4222-8222-222222222222",field:"priority",before:"normal",after:"critical"}]};
 try{
  const result=await generateRecovery("gemini",context,[id],1);
  expect(result.candidate.evidence_ids).toContain(id);
  expect(result.candidate.action_indices).toEqual([0]);
  expect(result.candidate.requires_human_approval).toBe(true);
  console.log("GEMINI_LIVE_SMOKE: PASS actual structured recommendation, evidence citation and allowed action validated; latency_ms="+result.latency_ms);
 }catch(error){
  const message=error instanceof Error&&/^(Gemini |The configured Gemini |No safe Gemini |Evidence exceeds)/.test(error.message)?error.message:"Structured recommendation validation failed.";
  throw new Error("GEMINI_LIVE_SMOKE: FAIL "+message);
 }
},40000);
