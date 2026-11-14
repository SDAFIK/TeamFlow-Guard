import {describe,it,expect} from "vitest";
import {seedGuest,guestReducer,guestRisks,guestOptions,guestGraph} from "./guest-sandbox";
describe("public guest sandbox",()=>{
 it("seeds six members, ten tasks, nine edges and four active risks",()=>{
  const s=seedGuest();expect(s.members).toHaveLength(6);expect(s.tasks).toHaveLength(10);expect(s.edges).toHaveLength(9);expect(guestRisks(s).filter(r=>r.active)).toHaveLength(4);
  expect(guestGraph(s,s.tasks[0].id).downstream_ids).toHaveLength(4);
 });
 it("proposes without mutation, approves once, preserves CI evidence",()=>{
  const s=seedGuest(),r=guestRisks(s).find(r=>r.evidence.kind==="ci_failure")!,o=guestOptions(s,r.id).find(o=>o.id==="priority")!;
  expect(o).toBeDefined();const p=guestReducer(s,{type:"propose",riskId:r.id,optionId:o.id});expect(p.tasks).toEqual(s.tasks);expect(p.version).toBe(1);
  const a=guestReducer(p,{type:"decide",id:p.proposals[0].id,decision:"approve"});expect(a.version).toBe(2);expect(a.tasks[0].priority).toBe("critical");expect(guestRisks(a).some(r=>r.active&&r.evidence.kind==="ci_failure")).toBe(true);
  expect(guestReducer(a,{type:"decide",id:p.proposals[0].id,decision:"approve"}).version).toBe(2);
  const pass=guestReducer(a,{type:"event",id:a.tasks[0].id,kind:"ci_pass"});expect(guestRisks(pass).some(r=>r.active&&r.evidence.kind==="ci_failure")).toBe(false);expect(guestRisks(pass).some(r=>r.active&&r.evidence.kind==="dependency")).toBe(true);
 });
 it("rejects stale decisions and cyclic links, isolates independent seeds",()=>{
  const s=seedGuest(),r=guestRisks(s)[0],p=guestReducer(s,{type:"propose",riskId:r.id,optionId:"priority"});
  const changed=guestReducer(p,{type:"hours",id:s.members[2].id,hours:20});
  expect(guestReducer(changed,{type:"decide",id:p.proposals[0].id,decision:"approve"}).proposals[0].status).toBe("stale");
  expect(guestReducer(s,{type:"link",source:s.tasks[5].id,target:s.tasks[0].id}).proposals).toHaveLength(0);
  expect(guestReducer(s,{type:"status",id:s.tasks[1].id,status:"done"}).tasks[1].status).toBe("in_progress");
  expect(seedGuest().members[2].available_hours).toBe(8);
  expect(guestRisks(seedGuest("healthy"))).toHaveLength(0);
 });
 it("recomputes capacity, rejects invalid tasks, resets only guest state",()=>{
  const s=seedGuest("capacity");expect(guestRisks(s).filter(r=>r.active)).toHaveLength(1);
  const changed=guestReducer(s,{type:"hours",id:s.members[2].id,hours:40});expect(guestRisks(changed).filter(r=>r.active)).toHaveLength(0);
  expect(guestReducer(s,{type:"task",title:"",owner:s.members[0].id,hours:4}).tasks).toHaveLength(10);
  const added=guestReducer(s,{type:"task",title:"New test",owner:s.members[0].id,hours:4});expect(added.tasks).toHaveLength(11);
  expect(guestReducer(added,{type:"reset",scenario:"review"}).tasks).toHaveLength(10);
 });
});
