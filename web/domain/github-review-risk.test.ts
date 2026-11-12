import { expect,it } from "vitest";
import { risksFor,type EvidenceRecord } from "./risk-engine";
import { taskIntelligence } from "./tic-features";
import { buildRecoveryOptions,githubReviewReviewer } from "./recovery-options";
const now=new Date("2026-11-13T00:00:00Z");
const task={id:"t",key:"T-1",title:"Review",owner_id:"owner",reviewer_id:null,estimate_hours:8,status:"todo",position:0,priority:"normal",due_at:"2026-11-14T00:00:00Z"};
const child={...task,id:"child",key:"T-2",position:1};
const e:EvidenceRecord={id:"e",task_id:"t",kind:"review_delay",title:"PR #7 review",detail:"Verified request",origin:"github",active:true,observed_at:now.toISOString(),payload:{ingestion:"github-review-reconciliation",review_status:"waiting",branch:"main",tracked_branch:"main",state:"open",is_draft:false,reviewer_id:"current",review_requested_at:"2026-11-11T00:00:00Z"}};
const member=(id:string)=>({id,name:id,role:"member",available_hours:8,availability_start:"2026-11-12T00:00:00Z",availability_end:"2026-11-14T00:00:00Z"});
const members=[member("current"),member("owner"),member("alternate")],edges=[{predecessor_id:"t",successor_id:"child"}];
it("identifies delayed review and downstream impact on tracked branch",()=>{
  expect(risksFor([task,child],edges,[e],members,24,now,"main")[0]).toMatchObject({active:true,severity:"medium",affected_task_ids:["child"]});
  expect(risksFor([task,child],edges,[e],members,24,now,"release")[0].active).toBe(false);
  expect(risksFor([task,child],edges,[{...e,active:false}],members,24,now,"main")[0].active).toBe(false);
});
it("uses persistent review evidence in real TIC features without enabling unvalidated predictions",()=>{
  const input={tasks:[task,child],edges,evidence:[e],members,trackedBranch:"main",isDemo:false,now};
  const result=taskIntelligence(input,"t")!;
  expect(result.features.review_hours).toBe(48);expect(result.prediction).toBeNull();
  expect(taskIntelligence({...input,trackedBranch:"release"},"t")!.features.review_hours).toBeNull();
});
it("excludes actual GitHub reviewer and requires dated alternative capacity",()=>{
  const options=buildRecoveryOptions([task,child],edges,members,"t","review_delay",now.getTime(),githubReviewReviewer(e));
  expect(options.find(o=>o.id==="coverage")?.actions[0].after).toBe("alternate");
  expect(options.find(o=>o.id==="coverage")?.tradeoff).toContain("separately on GitHub");
  expect(buildRecoveryOptions([task],[],[member("current"),{...member("alternate"),availability_start:"",availability_end:""}],"t","review_delay",now.getTime(),githubReviewReviewer(e)).some(o=>o.id==="coverage")).toBe(false);
});
