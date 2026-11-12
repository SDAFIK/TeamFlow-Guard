-- Prospective, opt-in task-level learning. Existing task timestamps remain unknown.
alter table public.tf_tasks add column created_at timestamptz;
alter table public.tf_tasks alter column created_at set default now();

create table teamflow_private.tf_learning_configs (
 workspace_id uuid primary key references public.tf_workspaces(id),
 group_id uuid not null default gen_random_uuid(),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table teamflow_private.tf_learning_samples (
 workspace_id uuid not null references public.tf_workspaces(id),
 task_id uuid not null,
 sample_id uuid not null default gen_random_uuid() unique,
 observed_at timestamptz not null,
 deadline_at timestamptz not null,
 features jsonb not null,
 completed_at timestamptz,
 excluded boolean not null default false,
 primary key(workspace_id,task_id),
 foreign key(workspace_id,task_id) references public.tf_tasks(workspace_id,id),
 check(deadline_at>observed_at)
);
alter table teamflow_private.tf_learning_configs enable row level security;
alter table teamflow_private.tf_learning_samples enable row level security;
revoke all on teamflow_private.tf_learning_configs,teamflow_private.tf_learning_samples from public,anon,authenticated,service_role;

-- Capture actual completion and invalidate deadline-revised or archived samples.
-- The trigger cannot modify a plan, and does nothing without an existing sample.
create function teamflow_private.learning_task_outcome() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.due_at is distinct from old.due_at or (new.archived and not old.archived) then
  update teamflow_private.tf_learning_samples s set excluded=true
   where s.workspace_id=new.workspace_id and s.task_id=new.id;
 elsif new.status='done' and old.status<>'done' then
  update teamflow_private.tf_learning_samples s set completed_at=clock_timestamp()
   where s.workspace_id=new.workspace_id and s.task_id=new.id and not s.excluded and s.completed_at is null;
 end if;
 return new;
end $$;
revoke all on function teamflow_private.learning_task_outcome() from public,anon,authenticated,service_role;
create trigger tf_learning_task_outcome after update of status,due_at,archived on public.tf_tasks
for each row execute function teamflow_private.learning_task_outcome();

create function teamflow_private.learning(w uuid,operation text,t uuid,enable boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces; m public.tf_memberships; task public.tf_tasks; cfg teamflow_private.tf_learning_configs;
 stamp timestamptz; availability public.tf_memberships; review_at timestamptz; review_count integer;
 streams integer; failures integer; retries integer; affected integer; depth integer; direct_count integer;
 load_hours integer; features_value jsonb; result jsonb; samples_count integer; label_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select * into ws from public.tf_workspaces where id=w;
 select * into m from public.tf_memberships where workspace_id=w and user_id=auth.uid();
 if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if operation is null or operation not in ('status','consent','capture','export') then raise exception 'Unsupported learning action' using errcode='22023'; end if;
 if operation in ('consent','export') and m.role<>'owner' then raise exception 'Owner access required' using errcode='42501'; end if;
 if operation='capture' and m.role not in ('owner','manager') then raise exception 'Manager access required' using errcode='42501'; end if;
 if ws.is_demo then
  if operation='status' then return jsonb_build_object('enabled',false,'samples',0,'labeled',0,'can_manage',false,'can_capture',false,'demo',true); end if;
  raise exception 'Demo learning disabled' using errcode='42501';
 end if;
 -- Serialize changes with existing plan and evidence mutation locks.
 if operation<>'status' then
  select * into ws from public.tf_workspaces where id=w for update;
  select * into m from public.tf_memberships where workspace_id=w and user_id=auth.uid();
  if not found or (operation in ('consent','export') and m.role<>'owner') or (operation='capture' and m.role not in ('owner','manager')) then raise exception 'Workspace access changed' using errcode='42501'; end if;
 end if;
 stamp:=clock_timestamp();
 select * into cfg from teamflow_private.tf_learning_configs c where c.workspace_id=w;
 if operation='consent' then
  if enable is null then raise exception 'Explicit consent required' using errcode='22023'; end if;
  if enable then
   insert into teamflow_private.tf_learning_configs(workspace_id,enabled,updated_at) values(w,true,stamp)
   on conflict(workspace_id) do update set enabled=true,updated_at=excluded.updated_at;
  else
   delete from teamflow_private.tf_learning_samples s where s.workspace_id=w;
   delete from teamflow_private.tf_learning_configs c where c.workspace_id=w;
  end if;
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version)
   values(w,m.user_id,m.name,case when enable then 'learning.enabled' else 'learning.disabled' end,
    case when enable then 'Owner enabled prospective task-level learning' else 'Owner disabled learning and purged stored samples' end,ws.plan_version);
  select * into cfg from teamflow_private.tf_learning_configs c where c.workspace_id=w;
 end if;
 if operation in ('status','consent') then
  select count(*),count(*) filter(where s.completed_at is not null or s.deadline_at<=stamp)
   into samples_count,label_count from teamflow_private.tf_learning_samples s where s.workspace_id=w and not s.excluded;
  return jsonb_build_object('enabled',coalesce(cfg.enabled,false),'samples',samples_count,'labeled',label_count,
   'can_manage',m.role='owner','can_capture',m.role in ('owner','manager'),'demo',false);
 end if;
 if not coalesce(cfg.enabled,false) then raise exception 'Learning is not enabled' using errcode='42501'; end if;
 if operation='export' then
  select coalesce(jsonb_agg(jsonb_build_object('source','real','consented',true,'workspace_group',cfg.group_id,
   'task_group',s.sample_id,'observed_at',s.observed_at,'deadline_at',s.deadline_at,'completed_at',s.completed_at,
   'outcome_observed_at',coalesce(s.completed_at,stamp),'deadline_changed',false,'features',s.features)
   order by s.observed_at),'[]'::jsonb) into result from teamflow_private.tf_learning_samples s
   where s.workspace_id=w and not s.excluded and (s.completed_at is not null or s.deadline_at<=stamp);
  return jsonb_build_object('schema_version','tic-real-v1','rows',result);
 end if;
 select * into task from public.tf_tasks q where q.workspace_id=w and q.id=t and not q.archived;
 if not found then raise exception 'Task unavailable' using errcode='22023'; end if;
 if exists(select 1 from teamflow_private.tf_learning_samples s where s.workspace_id=w and s.task_id=t) then
  return jsonb_build_object('status','already_captured');
 end if;
 if task.status='done' or task.created_at is null or task.created_at>stamp or task.due_at is null or task.due_at<=stamp then
  return jsonb_build_object('status','missing_evidence','reason','Requires an unfinished task created after learning migration, with a future deadline.');
 end if;
 if (select count(*) from public.tf_tasks q where q.workspace_id=w and not q.archived)>500 then
  return jsonb_build_object('status','missing_evidence','reason','Workspace exceeds the current learning graph limit.');
 end if;
 select * into availability from public.tf_memberships a where a.workspace_id=w and a.user_id=task.owner_id
  and a.available_hours>0 and a.availability_start<=stamp and a.availability_end>stamp and a.role<>'viewer';
 if not found then return jsonb_build_object('status','missing_evidence','reason','Current dated, positive owner availability required.'); end if;
 select coalesce(sum(q.estimate_hours),0) into load_hours from public.tf_tasks q
  where q.workspace_id=w and q.owner_id=task.owner_id and not q.archived and q.status<>'done';
 with ci as (
  select e.payload->>'workflow_id' workflow,e.payload->>'conclusion' conclusion,
   (e.payload->>'run_attempt')::integer attempt,
   row_number() over(order by e.observed_at desc,(e.payload->>'run_id')::bigint desc,(e.payload->>'run_attempt')::integer desc) rn
  from public.tf_evidence e where e.workspace_id=w and e.task_id=t and e.origin='github'
   and e.payload->>'ingestion'='github-app-webhook' and e.payload->>'branch'=ws.tracked_branch
   and e.observed_at between stamp-interval '72 hours' and stamp
   and e.kind in ('ci_failure','ci_pass') and e.payload->>'conclusion' in ('success','failure','timed_out')
 ), boundary as (select min(rn) filter(where conclusion='success') first_pass from ci)
 select count(distinct workflow),count(*) filter(where conclusion<>'success' and rn<coalesce(first_pass,9223372036854775807)),
  count(*) filter(where attempt>1) into streams,failures,retries from ci cross join boundary;
 if streams<>1 then return jsonb_build_object('status','missing_evidence','reason','Recent unambiguous signed CI history required.'); end if;
 select count(*),min((e.payload->>'review_requested_at')::timestamptz) into review_count,review_at
  from public.tf_evidence e where e.workspace_id=w and e.task_id=t and e.origin='github' and e.kind='review_delay' and e.active
   and e.payload->>'ingestion'='github-review-reconciliation' and e.payload->>'review_status'='waiting'
   and e.payload->>'branch'=ws.tracked_branch and e.observed_at between stamp-interval '72 hours' and stamp;
 if review_count<>1 or review_at is null or review_at>stamp then
  return jsonb_build_object('status','missing_evidence','reason','Current verified pending PR review required.');
 end if;
 with recursive descendants(id) as (
  select d.successor_id from public.tf_dependencies d join public.tf_tasks q on q.id=d.successor_id and q.workspace_id=w
   where d.workspace_id=w and d.predecessor_id=t and not q.archived and q.status<>'done'
  union
  select d.successor_id from descendants x join public.tf_dependencies d on d.predecessor_id=x.id and d.workspace_id=w
   join public.tf_tasks q on q.id=d.successor_id and q.workspace_id=w where not q.archived and q.status<>'done'
 ) select count(*) into affected from descendants;
 with recursive ancestors(id,d) as (
  select e.predecessor_id,1 from public.tf_dependencies e join public.tf_tasks q on q.id=e.predecessor_id and q.workspace_id=w
   where e.workspace_id=w and e.successor_id=t and not q.archived and q.status<>'done'
  union
  select e.predecessor_id,x.d+1 from ancestors x join public.tf_dependencies e on e.successor_id=x.id and e.workspace_id=w
   join public.tf_tasks q on q.id=e.predecessor_id and q.workspace_id=w where not q.archived and q.status<>'done' and x.d<200
 ) select coalesce(max(d),0),count(*) filter(where d=1) into depth,direct_count from ancestors;
 if depth>=200 then return jsonb_build_object('status','missing_evidence','reason','Dependency depth exceeds learning limit.'); end if;
 features_value:=jsonb_build_object('ci_failures',failures,'blocked',case when task.status='blocked' then 1 else 0 end,
  'review_hours',extract(epoch from stamp-review_at)/3600,'downstream_count',affected,
  'deadline_hours',extract(epoch from task.due_at-stamp)/3600,'capacity_gap',greatest(0,(task.estimate_hours-availability.available_hours)::numeric/task.estimate_hours),
  'estimate_hours',task.estimate_hours,'dependency_depth',depth,'unfinished_predecessors',direct_count,
  'workload_ratio',load_hours::numeric/availability.available_hours,'task_age_hours',extract(epoch from stamp-task.created_at)/3600,'ci_retries',retries);
 insert into teamflow_private.tf_learning_samples(workspace_id,task_id,observed_at,deadline_at,features)
  values(w,t,stamp,task.due_at,features_value);
 return jsonb_build_object('status','captured');
end $$;
revoke all on function teamflow_private.learning(uuid,text,uuid,boolean) from public,anon,service_role;
grant execute on function teamflow_private.learning(uuid,text,uuid,boolean) to authenticated;
create function public.tf_learning(w uuid,operation text,t uuid,enable boolean) returns jsonb
language sql security invoker set search_path='' as $$ select teamflow_private.learning(w,operation,t,enable) $$;
revoke all on function public.tf_learning(uuid,text,uuid,boolean) from public,anon,service_role;
grant execute on function public.tf_learning(uuid,text,uuid,boolean) to authenticated;

-- Recheck dated capacity at actual approval, not just proposal generation.
-- All applied task mutations roll back if this guard rejects the transition.
create function teamflow_private.guard_recovery_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare a jsonb; candidate uuid; m public.tf_memberships; load_hours integer; stamp timestamptz:=clock_timestamp();
begin
 if new.status<>'approved' or old.status<>'pending' or new.source not in ('rules','gemini') then return new; end if;
 if exists(select 1 from public.tf_workspaces w where w.id=new.workspace_id and w.is_demo) then return new; end if;
 for a in select value from jsonb_array_elements(new.actions) where value->>'field' in ('owner_id','reviewer_id') loop
  candidate:=(a->>'after')::uuid;
  select * into m from public.tf_memberships x where x.workspace_id=new.workspace_id and x.user_id=candidate
   and x.role<>'viewer' and x.availability_start<=stamp and x.availability_end>stamp;
  if not found then raise exception 'Recovery availability expired or unavailable; regenerate proposal' using errcode='PT409'; end if;
  select coalesce(sum(case when t.owner_id=candidate then t.estimate_hours else 0 end+
    case when t.reviewer_id=candidate then 2 else 0 end),0) into load_hours
   from public.tf_tasks t where t.workspace_id=new.workspace_id and not t.archived and t.status<>'done';
  if load_hours>m.available_hours then raise exception 'Recovery assignment exceeds current dated capacity; regenerate proposal' using errcode='PT409'; end if;
 end loop;
 return new;
end $$;
revoke all on function teamflow_private.guard_recovery_capacity() from public,anon,authenticated,service_role;
create trigger tf_recovery_capacity_guard before update of status on public.tf_proposals
for each row execute function teamflow_private.guard_recovery_capacity();
