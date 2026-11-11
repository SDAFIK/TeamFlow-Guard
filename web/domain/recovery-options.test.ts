import { expect, it } from 'vitest';
import { buildRecoveryOptions } from './recovery-options';
const root={id:'root',owner_id:'owner',reviewer_id:null,estimate_hours:8,status:'in_progress',position:0,priority:'normal',title:'Login'};
const members=[{id:'owner',name:'Owner',role:'member',available_hours:4},{id:'available',name:'Available',role:'member',available_hours:24}];
it('offers an ownership handoff for capacity without changing the input plan',()=>{
 const options=buildRecoveryOptions([root],[],members,'root','capacity');
 expect(options.find(o=>o.id==='coverage')?.actions).toEqual([{task_id:'root',field:'owner_id',before:'owner',after:'available'}]);
 expect(root.owner_id).toBe('owner');
});
it('does not overcommit already assigned estimates',()=>{
 const work={...root,id:'existing',owner_id:'available',estimate_hours:20};
 expect(buildRecoveryOptions([root,work],[],members,'root','capacity').some(o=>o.id==='coverage')).toBe(false);
});
it('excludes viewers, expired availability and self-review handoffs',()=>{
 for(const replacement of [{...members[1],role:'viewer'},{...members[1],availability_end:'2020-01-01T00:00:00Z'}])expect(buildRecoveryOptions([root],[],[members[0],replacement],'root','capacity').some(o=>o.id==='coverage')).toBe(false);
 expect(buildRecoveryOptions([{...root,reviewer_id:'available'}],[],members,'root','capacity').some(o=>o.id==='coverage')).toBe(false);
});
it('does not propose dependent work as an independent resequence',()=>{
 const dependent={...root,id:'child',position:1};
 expect(buildRecoveryOptions([root,dependent],[{successor_id:'child'}],members,'root','capacity').some(o=>o.id==='sequence')).toBe(false);
});
it('keeps CI recovery honest and completed work untouched',()=>{
 expect(buildRecoveryOptions([root],[],members,'root','ci_failure')[0].tradeoff).toContain('does not repair');
 expect(buildRecoveryOptions([{...root,status:'done'}],[],members,'root','capacity')).toEqual([]);
});
