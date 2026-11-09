create function teamflow_private.task_write(w uuid, operation text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m public.tf_memberships; ws public.tf_workspaces; t public.tf_tasks; previous jsonb;
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into ws from public.tf_workspaces where id=w for update;
 select * into m from public.tf_memberships where workspace_id=w and user_id=actor;
 if not found or m.role not in ('owner','manager') then raise exception 'Manager access required' using errcode='42501'; end if;
 if (body->>'base_plan_version')::int is distinct from ws.plan_version then raise exception 'Plan changed' using errcode='40001'; end if;
 if operation='create' then
  if not exists(select 1 from public.tf_memberships where workspace_id=w and user_id=(body->>'owner_id')::uuid and role<>'viewer') then raise exception 'Invalid owner' using errcode='22023'; end if;
  insert into public.tf_tasks(workspace_id,key,title,description,owner_id,estimate_hours,due_at,position)
   values(w,body->>'key',body->>'title',coalesce(body->>'description',''),(body->>'owner_id')::uuid,(body->>'estimate_hours')::int,(body->>'due_at')::timestamptz,(select coalesce(max(position),-1)+1 from public.tf_tasks where workspace_id=w)) returning * into t;
 elsif operation in ('edit','archive') then
  select * into t from public.tf_tasks where workspace_id=w and id=(body->>'task_id')::uuid and not archived;
  if not found then raise exception 'Task unavailable' using errcode='22023'; end if;
  if (body->>'expected_version')::int is distinct from t.version then raise exception 'Task changed' using errcode='40001'; end if;
  previous:=to_jsonb(t);
  if operation='archive' then
   if t.status not in ('todo','done') or exists(select 1 from public.tf_dependencies where workspace_id=w and (predecessor_id=t.id or successor_id=t.id)) then raise exception 'Only unconnected todo or completed tasks may be archived' using errcode='22023'; end if;
   update public.tf_tasks set archived=true,version=version+1 where id=t.id returning * into t;
  else
   update public.tf_tasks set title=body->>'title',description=coalesce(body->>'description',''),version=version+1 where id=t.id returning * into t;
  end if;
 else raise exception 'Invalid task operation' using errcode='22023'; end if;
 update public.tf_workspaces set plan_version=plan_version+1 where id=w;
 insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version,changes)
  values(w,actor,m.name,'task.'||operation,t.key||' '||operation,ws.plan_version+1,jsonb_build_array(jsonb_build_object('task_id',t.id,'before',previous,'after',to_jsonb(t))));
 return to_jsonb(t);
end $$;
revoke all on function teamflow_private.task_write(uuid,text,jsonb) from public,anon;
grant execute on function teamflow_private.task_write(uuid,text,jsonb) to authenticated;
create function public.tf_task_write(w uuid, operation text, body jsonb) returns jsonb language sql security invoker set search_path='' as $$ select teamflow_private.task_write(w,operation,body) $$;
revoke all on function public.tf_task_write(uuid,text,jsonb) from public,anon;
grant execute on function public.tf_task_write(uuid,text,jsonb) to authenticated;
