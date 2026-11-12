import {it,expect} from "vitest";
import {simulateRecovery} from "./tic-v2-recovery";
const root={id:"r",owner_id:"o",reviewer_id:null,estimate_hours:8,status:"todo",position:0,priority:"normal",title:"Root"};
const tasks=[root,{...root,id:"c",position:1,title:"Child"}],edges=[{predecessor_id:"r",successor_id:"c"}];
const m=(id:string,h:number)=>({id,name:id,role:"member",available_hours:h,availability_start:"2026-11-12T00:00:00Z",availability_end:"2026-11-14T00:00:00Z"});
const e={id:"e",task_id:"r",kind:"capacity",title:"Risk",detail:"",origin:"manual",active:true,observed_at:"2026-11-13T00:00:00Z",payload:{}};
it("simulates coverage without changing the plan or claiming delay reduction",()=>{const x=simulateRecovery(tasks,edges,[m("o",4),m("a",20)],e,Date.parse(e.observed_at));expect(x[0]).toMatchObject({id:"coverage",feasible:true,affected_task_ids:["c"],estimated_delay_reduction_hours:null,source_risk_resolved:false,requires_human_approval:true});expect(tasks[0].owner_id).toBe("o");});
it("does not report undated capacity as feasible",()=>{const x=simulateRecovery(tasks,edges,[m("o",4),{...m("a",20),availability_start:"",availability_end:""}],e,Date.parse(e.observed_at));expect(x.find(o=>o.id==="coverage")?.feasible).toBe(false);});
