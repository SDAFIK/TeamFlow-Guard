import {it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {generateRecovery} from "./recovery-provider";
import {simulateRecovery} from "@/domain/tic-v2-recovery";
it.skipIf(process.env.TEAMFLOW_TIC_DEMO_LIVE!=="1"||process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!=="codex/tic-demo-gemini-smoke")("genuine Gemini chooses a feasible action for fresh fictional CI rehearsal",async()=>{
 const now=Date.now(),taskId="11111111-1111-4111-8111-111111111111",ownerId="22222222-2222-4222-8222-222222222222",riskId="33333333-3333-4333-8333-333333333333";
 const task={id:taskId,key:"AI-TEST",title:"Fictional AI rehearsal · CI failure",owner_id:ownerId,reviewer_id:null,estimate_hours:8,status:"todo",position:0,priority:"normal"};
 const evidence={id:riskId,task_id:taskId,kind:"ci_failure",title:"Fictional CI failure",detail:"Explicitly replayed fictional CI failure; not live GitHub.",origin:"replay",active:true,observed_at:new Date(now).toISOString(),payload:{branch:"main",tracked_branch:"main",conclusion:"failure"}};
 const member={id:ownerId,name:"Fictional owner",role:"owner",available_hours:40,availability_start:null,availability_end:null};
 const alternatives=simulateRecovery([task],[],[member],evidence,now).filter(o=>o.feasible);
 expect(alternatives.map(o=>o.id)).toEqual(["priority"]);
 const options=alternatives.flatMap(o=>o.actions);
 const context={risk:"Failed check mapped to AI-TEST on tracked branch main; 0 unfinished downstream tasks.",risk_kind:evidence.kind,affected_task_ids:[],task:{id:taskId,key:task.key,title:task.title},evidence:[{id:riskId,origin:"replay",title:evidence.title,detail:evidence.detail,observed_at:evidence.observed_at}],candidates:options,simulations:alternatives.map(o=>({id:o.id,capacity:o.capacity,affected_task_ids:o.affected_task_ids,source_risk_resolved:false,limitations:o.limitations}))};
 try{const r=await generateRecovery("gemini",context,[riskId],options.length);expect(r.candidate.action_indices).toEqual([0]);expect(r.candidate.evidence_ids).toEqual([riskId]);expect(r.candidate.requires_human_approval).toBe(true);console.log("TIC_DEMO_GEMINI: PASS genuine provider response, fresh CI rehearsal, priority action and human approval; latency_ms="+r.latency_ms);}catch(e){console.log("TIC_DEMO_GEMINI: FAIL "+((e as Error).name==="AssertionError"?"provider returned an abstention or unexpected candidate":"provider or validation unavailable"));throw Error("Fresh fictional Gemini rehearsal did not return the supported recommendation");}
},40000);
