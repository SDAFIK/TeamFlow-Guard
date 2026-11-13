import {describe,it,expect} from "vitest";
import {downstream,validateGraph} from "./graph";
describe("large dependency networks",()=>{
 it("traverses a 500-task branching DAG without recursion, duplicates or missing nodes",()=>{
  const ids=Array.from({length:500},(_,i)=>String(i));
  const edges=ids.slice(1).flatMap((id,i)=>[{predecessor_id:String(i),successor_id:id},...(i>0?[{predecessor_id:String(i-1),successor_id:id}]:[])]);
  expect(()=>validateGraph(ids,edges)).not.toThrow();
  expect(downstream(ids,edges,"0")).toHaveLength(499);
  expect(downstream(ids,edges,"499",true)).toHaveLength(499);
  expect(()=>validateGraph(ids,[...edges,{predecessor_id:"499",successor_id:"0"}])).toThrow(/cycle/);
  expect(()=>validateGraph(ids,[...edges,edges[0]])).toThrow(/already exists/);
 });
});
