-- Reject incomplete direct RPC requests independently of the HTTP schema.
create or replace function teamflow_private.validate_actions(w uuid, actions jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare a jsonb; t public.tf_tasks; member public.tf_memberships; f text; actual jsonb; cyc boolean;
begin
 if actions is null or jsonb_typeof(actions)<>'array' or jsonb_array_length(actions) not between 1 and 8 then raise exception 'Invalid actions' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(actions) x group by x->>'task_id',x->>'field' having count(*)>1) then raise exception 'Duplicate action' using errcode='22023'; end if;
 for a in select * from jsonb_array_elements(actions) loop
  select * into t from public.tf_tasks where workspace_id=w and id=(a->>'task_id')::uuid and not archived;
  if not found or t.status='done' then raise exception 'Task unavailable or complete' using errcode='22023'; end if;
  f:=a->>'field';
  if f is null or f not in ('reviewer_id','priority','position','dependency','owner_id','due_at') then raise exception 'Unsupported action' using errcode='22023'; end if;
  if not (a ? 'after') or (a->'after'='null'::jsonb and f<>'due_at') then raise exception 'Missing action value' using errcode='22023'; end if;
  actual:=case when f='dependency' then 'null'::jsonb else to_jsonb(t)->f end;
  if actual is distinct from a->'before' then raise exception 'Task changed; regenerate proposal' using errcode='40001'; end if;
  if f in ('reviewer_id','owner_id') then
   select * into member from public.tf_memberships where workspace_id=w and user_id=(a->>'after')::uuid and role<>'viewer';
   if not found or member.available_hours < (case when f='reviewer_id' then 2 else t.estimate_hours end) then raise exception 'Member has insufficient reported capacity' using errcode='22023'; end if;
  elsif f='priority' and a->>'after' not in ('normal','high','critical') then raise exception 'Invalid priority' using errcode='22023';
  elsif f='position' and ((a->>'after')::integer <0 or (a->>'after')::integer >= (select count(*) from public.tf_tasks where workspace_id=w and not archived)) then raise exception 'Invalid position' using errcode='22023';
  elsif f='due_at' then perform (a->>'after')::timestamptz;
  elsif f='dependency' then
   if not exists(select 1 from public.tf_tasks where workspace_id=w and id=(a->>'after')::uuid and not archived) or t.id=(a->>'after')::uuid then raise exception 'Invalid dependency' using errcode='22023'; end if;
   if exists(select 1 from public.tf_dependencies where workspace_id=w and predecessor_id=(a->>'after')::uuid and successor_id=t.id) then raise exception 'Dependency already exists' using errcode='22023'; end if;
  end if;
 end loop;
 -- Validate all proposed edges together, not just one at a time.
 with recursive edges as (
  select predecessor_id a,successor_id b from public.tf_dependencies where workspace_id=w
  union select (x->>'after')::uuid,(x->>'task_id')::uuid from jsonb_array_elements(actions) x where x->>'field'='dependency'
 ), paths(a,b) as (select e.a,e.b from edges e union select p.a,e.b from paths p join edges e on p.b=e.a)
 select exists(select 1 from paths p where p.a=p.b) into cyc;
 if cyc then raise exception 'Dependency would create a cycle' using errcode='22023'; end if;
 if exists (
  select 1 from public.tf_memberships m where m.workspace_id=w and
  (select count(*)*2 from public.tf_tasks assigned where assigned.workspace_id=w and not assigned.archived and assigned.status<>'done'
   and coalesce((select (x->>'after')::uuid from jsonb_array_elements(actions) x where x->>'field'='reviewer_id' and (x->>'task_id')::uuid=assigned.id),assigned.reviewer_id)=m.user_id)>m.available_hours
 ) then raise exception 'Combined review assignments exceed capacity' using errcode='22023'; end if;
end $$;
revoke all on function teamflow_private.validate_actions(uuid,jsonb) from public,anon,authenticated;

create or replace function teamflow_private.mutate(w uuid, operation text, body jsonb, request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.tf_memberships; ws public.tf_workspaces; t public.tf_tasks; p public.tf_proposals;
 a jsonb; before_task jsonb; changes jsonb:='[]'; result jsonb; receipt public.tf_receipts; aid uuid; eid uuid; field text; v integer; ref uuid; existing public.tf_evidence;
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into ws from public.tf_workspaces where id=w for update;
 select * into m from public.tf_memberships where workspace_id=w and user_id=actor;
 if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if m.role='viewer' then raise exception 'Viewer access is read-only' using errcode='42501'; end if;
 v:=ws.plan_version;
 if operation='decision' then
  if m.role not in ('owner','manager') then raise exception 'Manager approval required' using errcode='42501'; end if;
  if request_key is null or length(request_key) not between 8 and 120 then raise exception 'Idempotency key required' using errcode='22023'; end if;
  select * into receipt from public.tf_receipts where workspace_id=w and actor_id=actor and tf_receipts.request_key=mutate.request_key;
  if found then
   if receipt.request_body<>body then raise exception 'Idempotency key reused' using errcode='40001'; end if;
   return receipt.result;
  end if;
  select * into p from public.tf_proposals where workspace_id=w and id=(body->>'proposal_id')::uuid for update;
  if not found then raise exception 'Proposal unavailable' using errcode='22023'; end if;
  if p.status<>'pending' then raise exception 'Proposal already decided' using errcode='40001'; end if;
  if body->>'decision' is null or body->>'decision' not in ('approve','reject') then raise exception 'Invalid decision' using errcode='22023'; end if;
  if body->>'decision'='approve' then
   if p.base_plan_version is distinct from v or (body->>'base_plan_version')::int is distinct from v then raise exception 'Plan changed; regenerate proposal' using errcode='40001'; end if;
   if exists(select 1 from unnest(p.evidence_ids) x where not exists(select 1 from public.tf_evidence where workspace_id=w and id=x and active and observed_at>now()-interval '72 hours')) then raise exception 'Evidence changed or expired' using errcode='40001'; end if;
   perform teamflow_private.validate_actions(w,p.actions);
   for a in select * from jsonb_array_elements(p.actions) loop
    select * into t from public.tf_tasks where workspace_id=w and id=(a->>'task_id')::uuid;
    field:=a->>'field';
    if field='dependency' then insert into public.tf_dependencies values(w,(a->>'after')::uuid,t.id);
    elsif field='position' then
     -- Include every shifted task in the audit, not only the selected card.
     for before_task in select to_jsonb(q) from public.tf_tasks q where workspace_id=w and not archived and id<>t.id and position between least(t.position,(a->>'after')::int) and greatest(t.position,(a->>'after')::int) loop
      update public.tf_tasks set position=position+case when t.position>(a->>'after')::int then 1 else -1 end,version=version+1 where id=(before_task->>'id')::uuid;
      changes:=changes||jsonb_build_array(jsonb_build_object('task_id',before_task->>'id','field','position','before',before_task->'position','after',(before_task->>'position')::int+case when t.position>(a->>'after')::int then 1 else -1 end));
     end loop;
     update public.tf_tasks set position=(a->>'after')::int where id=t.id;
    elsif field='priority' then update public.tf_tasks set priority=a->>'after' where id=t.id;
    elsif field='reviewer_id' then update public.tf_tasks set reviewer_id=(a->>'after')::uuid where id=t.id;
    elsif field='owner_id' then update public.tf_tasks set owner_id=(a->>'after')::uuid where id=t.id;
    elsif field='due_at' then update public.tf_tasks set due_at=(a->>'after')::timestamptz where id=t.id;
    end if;
    update public.tf_tasks set version=version+1 where id=t.id;
    changes:=changes||jsonb_build_array(a);
   end loop;
   v:=v+1;
  end if;
  update public.tf_proposals set status=case when body->>'decision'='approve' then 'approved' else 'rejected' end where id=p.id returning * into p;
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version,changes,proposal_id)
   values(w,actor,m.name,'proposal.'||p.status,p.title,v,changes,p.id) returning id into aid;
  result:=jsonb_build_object('proposal_id',p.id,'status',p.status,'plan_version',v,'audit_id',aid);
  insert into public.tf_receipts values(w,actor,request_key,body,result);
 elsif operation='proposal' then
  if (body->>'base_plan_version')::int is distinct from v then raise exception 'Plan changed' using errcode='40001'; end if;
  perform teamflow_private.validate_actions(w,body->'actions');
  if exists(select 1 from jsonb_array_elements_text(coalesce(body->'evidence_ids','[]')) x where not exists(select 1 from public.tf_evidence where workspace_id=w and id=x::uuid and active)) then raise exception 'Invalid evidence' using errcode='22023'; end if;
  insert into public.tf_proposals(workspace_id,created_by,title,explanation,source,base_plan_version,actions,evidence_ids,assumptions,risk_id)
   values(w,actor,body->>'title',body->>'explanation',body->>'source',v,body->'actions',array(select jsonb_array_elements_text(coalesce(body->'evidence_ids','[]'))::uuid),coalesce(body->'assumptions','[]'),(body->>'risk_id')::uuid) returning * into p;
  result:=to_jsonb(p)||jsonb_build_object('stale',false);
 elsif operation='status' then
  select * into t from public.tf_tasks where workspace_id=w and id=(body->>'task_id')::uuid and not archived;
  if not found then raise exception 'Task unavailable' using errcode='22023'; end if;
  if m.role not in ('owner','manager') and t.owner_id<>actor then raise exception 'Only assignee or manager may edit' using errcode='42501'; end if;
  if t.version is distinct from (body->>'expected_version')::int then raise exception 'Task changed' using errcode='40001'; end if;
  if t.status='done' and body->>'status'<>'done' then raise exception 'Completed work is preserved' using errcode='22023'; end if;
  changes:=jsonb_build_array(jsonb_build_object('task_id',t.id,'field','status','before',t.status,'after',body->>'status'));
  update public.tf_tasks set status=body->>'status',version=version+1 where id=t.id returning * into t;
  update public.tf_evidence set active=false where workspace_id=w and task_id=t.id and kind='dependency';
  if t.status='blocked' then insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin) values(w,t.id,'status:'||t.id||':'||t.version,'dependency',t.key||' is blocked',coalesce(body->>'note','Reported by assignee'),'manual'); end if;
  v:=v+1; result:=to_jsonb(t);
 elsif operation='availability' then
  if (body->>'end_at')::timestamptz<=(body->>'start_at')::timestamptz then raise exception 'Invalid availability dates' using errcode='22023'; end if;
  update public.tf_memberships set available_hours=(body->>'hours')::int,availability_start=(body->>'start_at')::timestamptz,availability_end=(body->>'end_at')::timestamptz where workspace_id=w and user_id=actor;
  v:=v+1;
  update public.tf_evidence set active=false where workspace_id=w and kind='capacity' and task_id in(select id from public.tf_tasks where workspace_id=w and owner_id=actor);
  insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin)
   select w,id,'capacity:'||id||':'||v,'capacity',key||' voluntary availability','Member reported dated availability; no private reason is stored.','manual' from public.tf_tasks where workspace_id=w and owner_id=actor and status<>'done' and not archived;
  changes:=jsonb_build_array(jsonb_build_object('field','availability','before',jsonb_build_object('hours',m.available_hours,'start_at',m.availability_start,'end_at',m.availability_end),'after',body));
  result:=jsonb_build_object('message','Your availability has been saved.');
 elsif operation='replay' then
  if not ws.is_demo or m.role not in ('owner','manager') then raise exception 'Demo replay requires a demo manager' using errcode='42501'; end if;
  select * into t from public.tf_tasks where workspace_id=w and id=(body->>'task_id')::uuid and not archived;
  if not found then raise exception 'Task unavailable' using errcode='22023'; end if;
  select * into existing from public.tf_evidence where workspace_id=w and source_key=body->>'event_key';
  if found then
   if existing.kind<>body->>'kind' or existing.task_id<>t.id then raise exception 'Event key reused' using errcode='40001'; end if;
   return jsonb_build_object('message','Event already recorded');
  end if;
  field:=body->>'kind';
  if field not in ('ci_failure','ci_pass','review_delay','capacity','dependency') then raise exception 'Invalid replay' using errcode='22023'; end if;
  update public.tf_evidence set active=false where workspace_id=w and task_id=t.id and origin in ('seed','replay') and (kind=field or (field='ci_pass' and kind='ci_failure'));
  insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin,active,payload)
   values(w,t.id,body->>'event_key',field,t.key||' · '||field,'Explicitly replayed fictional scenario; not a live integration.','replay',field<>'ci_pass',
    case when field in ('ci_failure','ci_pass') then jsonb_build_object('branch',ws.tracked_branch,'tracked_branch',ws.tracked_branch,'conclusion',case when field='ci_pass' then 'success' else 'failure' end)
    when field='review_delay' then jsonb_build_object('state','open','is_draft',false,'reviewer_id',coalesce(t.reviewer_id,t.owner_id),'review_requested_at',now()-interval '48 hours') else '{}'::jsonb end) returning id into eid;
  if field='capacity' then update public.tf_memberships set available_hours=4,availability_start=now(),availability_end=now()+interval '2 days' where workspace_id=w and user_id=t.owner_id; v:=v+1; end if;
  if field='dependency' then update public.tf_tasks set status='blocked',version=version+1 where id=t.id; v:=v+1; end if;
  changes:=jsonb_build_array(jsonb_build_object('evidence_id',eid,'origin','replay'));
  result:=jsonb_build_object('message','Demo event recorded');
 else raise exception 'Unsupported operation' using errcode='22023';
 end if;
 update public.tf_workspaces set plan_version=v where id=w;
 if operation not in ('decision','proposal') then
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version,changes) values(w,actor,m.name,operation,case when operation='replay' then 'Labeled demo event replayed' else 'Workspace '||operation||' updated' end,v,changes);
 end if;
 return result;
end $$;
revoke all on function teamflow_private.mutate(uuid,text,jsonb,text) from public,anon;
grant execute on function teamflow_private.mutate(uuid,text,jsonb,text) to authenticated;
