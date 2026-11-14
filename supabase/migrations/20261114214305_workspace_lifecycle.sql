-- Stage 1: additive lifecycle metadata, owner-only actions and transactional purge.
-- Existing workspace records and memberships are unchanged by migration.
alter table public.tf_workspaces add column archived_at timestamptz;
-- Minimal security receipt only: no project names, tasks, email or plan contents.
create table teamflow_private.tf_workspace_deletions (
 workspace_id uuid primary key, deleted_at timestamptz not null default clock_timestamp()
);
alter table teamflow_private.tf_workspace_deletions enable row level security;
revoke all on teamflow_private.tf_workspace_deletions from public,anon,authenticated,service_role;

-- Lock the workspace before each child mutation. Existing RPCs use this same
-- workspace lock, so archive/delete cannot interleave with plan writes.
create function teamflow_private.guard_archived_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
declare wid uuid; archived timestamptz;
begin
 wid:=case when TG_OP='DELETE' then OLD.workspace_id else NEW.workspace_id end;
 select p.archived_at into archived from public.tf_workspaces p where p.id=wid for share;
 if archived is not null then
  raise exception 'Workspace archived; restore before changing it' using errcode='PT409';
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
revoke all on function teamflow_private.guard_archived_workspace() from public,anon,authenticated,service_role;

do $$ declare rel text; begin
 foreach rel in array array['public.tf_memberships','public.tf_tasks','public.tf_dependencies',
  'public.tf_evidence','public.tf_proposals','public.tf_audit','public.tf_receipts',
  'public.tf_analysis','public.tf_invites','teamflow_private.tf_review_deliveries',
  'teamflow_private.tf_learning_configs','teamflow_private.tf_learning_samples',
  'teamflow_private.tf_github_workspace_mappings'] loop
  execute format('create trigger tf_lifecycle_archive_guard before insert or update or delete on %s for each row execute function teamflow_private.guard_archived_workspace()',rel);
 end loop;
end $$;

-- A normal settings/GitHub mutation cannot edit an archived workspace.
create function teamflow_private.guard_archived_settings() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if OLD.archived_at is not null and NEW.archived_at is not null and NEW is distinct from OLD then
  raise exception 'Workspace archived; restore before changing it' using errcode='PT409';
 end if;
 return NEW;
end $$;
revoke all on function teamflow_private.guard_archived_settings() from public,anon,authenticated,service_role;
create trigger tf_lifecycle_settings_guard before update on public.tf_workspaces
 for each row execute function teamflow_private.guard_archived_settings();

create function teamflow_private.workspace_lifecycle(w uuid, operation text, confirmed_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ws public.tf_workspaces; actor_name text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null) then
  raise exception 'Verified email required' using errcode='42501';
 end if;
 select * into ws from public.tf_workspaces where id=w for update;
 if not found then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select m.name into actor_name from public.tf_memberships m where m.workspace_id=w and m.user_id=actor and m.role='owner';
 if not found then raise exception 'Owner required' using errcode='42501'; end if;
 if operation='archive' then
  if ws.archived_at is not null then return jsonb_build_object('id',w,'status','archived'); end if;
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version)
   values(w,actor,actor_name,'workspace.archived','Workspace archived',ws.plan_version+1);
  update public.tf_workspaces set archived_at=clock_timestamp(),plan_version=plan_version+1 where id=w;
  return jsonb_build_object('id',w,'status','archived');
 elsif operation='restore' then
  if ws.archived_at is null then return jsonb_build_object('id',w,'status','active'); end if;
  update public.tf_workspaces set archived_at=null,plan_version=plan_version+1 where id=w;
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version)
   values(w,actor,actor_name,'workspace.restored','Workspace restored',ws.plan_version+1);
  return jsonb_build_object('id',w,'status','active');
 elsif operation='delete' then
  if confirmed_name is distinct from ws.name then
   raise exception 'Workspace name does not match' using errcode='22023';
  end if;
  -- If archived, unfreeze within the same locked transaction solely for purge.
  -- No intermediate state is visible and any constraint failure rolls back.
  if ws.archived_at is not null then update public.tf_workspaces set archived_at=null where id=w; end if;
  delete from teamflow_private.tf_github_workspace_mappings where workspace_id=w;
  delete from teamflow_private.tf_review_deliveries where workspace_id=w;
  delete from teamflow_private.tf_learning_samples where workspace_id=w;
  delete from teamflow_private.tf_learning_configs where workspace_id=w;
  delete from public.tf_analysis where workspace_id=w;
  delete from public.tf_receipts where workspace_id=w;
  delete from public.tf_audit where workspace_id=w;
  delete from public.tf_proposals where workspace_id=w;
  delete from public.tf_evidence where workspace_id=w;
  delete from public.tf_dependencies where workspace_id=w;
  delete from public.tf_tasks where workspace_id=w;
  delete from public.tf_invites where workspace_id=w;
  delete from public.tf_memberships where workspace_id=w;
  delete from public.tf_workspaces where id=w;
  insert into teamflow_private.tf_workspace_deletions(workspace_id) values(w);
  return jsonb_build_object('id',w,'status','deleted');
 else raise exception 'Unknown lifecycle action' using errcode='22023';
 end if;
end $$;
revoke all on function teamflow_private.workspace_lifecycle(uuid,text,text) from public,anon;
grant execute on function teamflow_private.workspace_lifecycle(uuid,text,text) to authenticated;
create function public.tf_workspace_lifecycle(w uuid, operation text, confirmed_name text default null) returns jsonb
language sql security invoker set search_path='' as $$
 select teamflow_private.workspace_lifecycle(w,operation,confirmed_name)
$$;
revoke all on function public.tf_workspace_lifecycle(uuid,text,text) from public,anon,service_role;
grant execute on function public.tf_workspace_lifecycle(uuid,text,text) to authenticated;

-- Preserve the existing signed GitHub contract: late events for archived or
-- deleted workspaces are acknowledged but cannot recreate or alter data.
create or replace function public.tf_ingest_github_ci(w uuid, t uuid, repo text, workflow_id bigint, run_id bigint, attempt integer, branch text, conclusion text, observed timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces; latest uuid; inserted uuid; source text; task_key text;
begin
 if repo is null or repo !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' or workflow_id is null or workflow_id<=0 or run_id is null or run_id<=0 or attempt is null or attempt<=0 or branch is null or length(branch) not between 1 and 255 or conclusion is null or conclusion not in ('success','failure','timed_out') or observed is null or observed>now()+interval '5 minutes' then
  raise exception 'Invalid CI evidence' using errcode='22023';
 end if;
 select * into ws from public.tf_workspaces where id=w for update;
 if not found and exists(select 1 from teamflow_private.tf_workspace_deletions d where d.workspace_id=w) then return jsonb_build_object('status','ignored_deleted'); end if;
 if ws.archived_at is not null then return jsonb_build_object('status','ignored_archived'); end if;
 if not found or ws.is_demo then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if branch<>ws.tracked_branch then return jsonb_build_object('status','ignored_branch'); end if;
 select key into task_key from public.tf_tasks where workspace_id=w and id=t and not archived;
 if not found then raise exception 'Mapped task unavailable' using errcode='22023'; end if;
 source:='github-webhook:'||repo||':'||run_id||':'||attempt;
 if exists(select 1 from public.tf_evidence where workspace_id=w and source_key=source and task_id<>t) then raise exception 'Run already mapped' using errcode='22023'; end if;
 insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin,active,observed_at,payload)
 values(w,t,source,case when conclusion='success' then 'ci_pass' else 'ci_failure' end,'CI run #'||run_id||': '||conclusion,'Signed GitHub workflow event mapped to '||task_key,'github',false,observed,
 jsonb_build_object('repository',repo,'workflow_id',workflow_id,'run_id',run_id,'run_attempt',attempt,'branch',branch,'tracked_branch',ws.tracked_branch,'conclusion',conclusion,'source_url','https://github.com/'||repo||'/actions/runs/'||run_id,'ingestion','github-app-webhook'))
 on conflict(workspace_id,source_key) do nothing returning id into inserted;
 if inserted is null then return jsonb_build_object('status','duplicate'); end if;
 select id into latest from public.tf_evidence e where e.workspace_id=w and e.task_id=t and e.origin='github' and e.payload->>'ingestion'='github-app-webhook' and e.payload->>'repository'=repo and e.payload->>'workflow_id'=workflow_id::text and e.payload->>'branch'=branch
 order by e.observed_at desc,(e.payload->>'run_id')::bigint desc,(e.payload->>'run_attempt')::integer desc limit 1;
 update public.tf_evidence e set active=(e.id=latest) where e.workspace_id=w and e.task_id=t and e.origin='github' and e.payload->>'ingestion'='github-app-webhook' and e.payload->>'repository'=repo and e.payload->>'workflow_id'=workflow_id::text and e.payload->>'branch'=branch;
 return jsonb_build_object('status','recorded','evidence_id',inserted);
end $$;

create or replace function teamflow_private.github_review_context(w uuid,t uuid,reviewer uuid) returns text
language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces;
begin
 select * into ws from public.tf_workspaces where id=w;
 if not found and exists(select 1 from teamflow_private.tf_workspace_deletions d where d.workspace_id=w) then return null; end if;
 if ws.archived_at is not null then return null; end if;
 if not found or ws.is_demo then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.tf_tasks q where q.workspace_id=w and q.id=t and not q.archived)
 or not exists(select 1 from public.tf_memberships m where m.workspace_id=w and m.user_id=reviewer and m.role<>'viewer')
 then raise exception 'Review mapping unavailable' using errcode='22023'; end if;
 return ws.tracked_branch;
end $$;

create or replace function teamflow_private.ingest_github_review(w uuid,t uuid,reviewer uuid,repo text,pull_number bigint,github_reviewer_id bigint,delivery_id uuid,tracked text,branch text,review_status text,requested timestamptz,observed timestamptz,pr_state text,is_draft boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces; latest public.tf_evidence; receipt teamflow_private.tf_review_deliveries; eid uuid; task_key text; payload_value jsonb; result_status text;
begin
 if repo is null or repo !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$'
 or pull_number is null or pull_number<=0 or github_reviewer_id is null or github_reviewer_id<=0 or delivery_id is null
 or tracked is null or length(tracked) not between 1 and 255 or branch is null or length(branch) not between 1 and 255
 or review_status is null or review_status not in ('waiting','inactive','not_requested','unrelated_branch','unknown_history')
 or pr_state is null or pr_state not in ('open','closed') or is_draft is null or observed is null or observed>clock_timestamp()+interval '5 minutes'
 then raise exception 'Invalid review evidence' using errcode='22023'; end if;
 if (review_status='waiting' and (branch<>tracked or pr_state<>'open' or is_draft or requested is null or requested>observed))
 or (review_status<>'waiting' and requested is not null)
 or (review_status='unrelated_branch' and branch=tracked)
 or (review_status<>'unrelated_branch' and branch<>tracked)
 or (review_status='inactive' and pr_state='open' and not is_draft)
 or (review_status in ('not_requested','unknown_history') and (pr_state<>'open' or is_draft))
 then raise exception 'Inconsistent review evidence' using errcode='22023'; end if;
 select * into ws from public.tf_workspaces where id=w for update;
 if not found and exists(select 1 from teamflow_private.tf_workspace_deletions d where d.workspace_id=w) then return jsonb_build_object('status','ignored_deleted'); end if;
 if ws.archived_at is not null then return jsonb_build_object('status','ignored_archived'); end if;
 if not found or ws.is_demo then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if ws.tracked_branch<>tracked then raise exception 'Tracked branch changed; reconcile again' using errcode='40001'; end if;
 perform teamflow_private.github_review_context(w,t,reviewer);
 select q.key into task_key from public.tf_tasks q where q.workspace_id=w and q.id=t and not q.archived;
 select * into receipt from teamflow_private.tf_review_deliveries d where d.workspace_id=w and d.delivery_id=ingest_github_review.delivery_id;
 if found then
  if receipt.task_id<>t or receipt.reviewer_id<>reviewer or receipt.repository<>repo or receipt.pull_number<>pull_number or receipt.github_reviewer_id<>github_reviewer_id then
   raise exception 'Delivery mapping changed' using errcode='40001';
  end if;
  return jsonb_build_object('status','duplicate','evidence_id',receipt.evidence_id);
 end if;
 select * into latest from public.tf_evidence e where e.workspace_id=w and e.origin='github' and e.kind='review_delay'
  and e.payload->>'ingestion'='github-review-reconciliation' and e.payload->>'repository'=repo
  and e.payload->>'pull_number'=pull_number::text
 order by e.observed_at desc,e.id desc limit 1;
 if found and latest.observed_at>=observed then
  eid:=latest.id; result_status:='stale_observation';
 else
  payload_value:=jsonb_build_object('ingestion','github-review-reconciliation','repository',repo,'pull_number',pull_number,
   'github_reviewer_id',github_reviewer_id,'reviewer_id',reviewer,'branch',branch,'tracked_branch',tracked,
   'review_status',review_status,'state',pr_state,'is_draft',is_draft,'review_requested_at',requested,
   'source_url','https://github.com/'||repo||'/pull/'||pull_number);
  if latest.id is not null and latest.task_id=t and latest.payload=payload_value then
   update public.tf_evidence e set observed_at=observed where e.id=latest.id and e.workspace_id=w;
   eid:=latest.id; result_status:='refreshed';
  else
   insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin,active,observed_at,payload)
    values(w,t,'github-review:'||repo||':'||pull_number||':'||delivery_id,'review_delay',
     'PR #'||pull_number||' review: '||review_status,'Verified GitHub review observation mapped to '||task_key,'github',review_status='waiting',observed,payload_value)
    returning id into eid;
   update public.tf_evidence e set active=false where e.workspace_id=w and e.origin='github' and e.kind='review_delay'
    and e.payload->>'ingestion'='github-review-reconciliation' and e.payload->>'repository'=repo
    and e.payload->>'pull_number'=pull_number::text and e.id<>eid and e.active;
   result_status:='recorded';
  end if;
 end if;
 insert into teamflow_private.tf_review_deliveries(workspace_id,delivery_id,task_id,reviewer_id,repository,pull_number,github_reviewer_id,evidence_id)
 values(w,delivery_id,t,reviewer,repo,pull_number,github_reviewer_id,eid);
 return jsonb_build_object('status',result_status,'evidence_id',eid);
end $$;

