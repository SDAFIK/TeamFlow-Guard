-- Phase 5B: isolated service-only review observations. No plan, task, or proposal writes.
create table teamflow_private.tf_review_deliveries (
 workspace_id uuid not null references public.tf_workspaces(id),
 delivery_id uuid not null, task_id uuid not null, reviewer_id uuid not null, repository text not null,
 pull_number bigint not null, github_reviewer_id bigint not null,
 evidence_id uuid, recorded_at timestamptz not null default now(),
 primary key(workspace_id,delivery_id),
 foreign key(workspace_id,task_id) references public.tf_tasks(workspace_id,id),
 foreign key(workspace_id,reviewer_id) references public.tf_memberships(workspace_id,user_id),
 foreign key(workspace_id,evidence_id) references public.tf_evidence(workspace_id,id)
);
alter table teamflow_private.tf_review_deliveries enable row level security;
revoke all on teamflow_private.tf_review_deliveries from public,anon,authenticated,service_role;
grant usage on schema teamflow_private to service_role;

create function teamflow_private.github_review_context(w uuid,t uuid,reviewer uuid) returns text
language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces;
begin
 select * into ws from public.tf_workspaces where id=w;
 if not found or ws.is_demo then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.tf_tasks q where q.workspace_id=w and q.id=t and not q.archived)
 or not exists(select 1 from public.tf_memberships m where m.workspace_id=w and m.user_id=reviewer and m.role<>'viewer')
 then raise exception 'Review mapping unavailable' using errcode='22023'; end if;
 return ws.tracked_branch;
end $$;
revoke all on function teamflow_private.github_review_context(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function teamflow_private.github_review_context(uuid,uuid,uuid) to service_role;
create function public.tf_github_review_context(w uuid,t uuid,reviewer uuid) returns text
language sql security invoker set search_path='' as $$ select teamflow_private.github_review_context(w,t,reviewer) $$;
revoke all on function public.tf_github_review_context(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.tf_github_review_context(uuid,uuid,uuid) to service_role;

create function teamflow_private.ingest_github_review(w uuid,t uuid,reviewer uuid,repo text,pull_number bigint,github_reviewer_id bigint,delivery_id uuid,tracked text,branch text,review_status text,requested timestamptz,observed timestamptz,pr_state text,is_draft boolean)
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
revoke all on function teamflow_private.ingest_github_review(uuid,uuid,uuid,text,bigint,bigint,uuid,text,text,text,timestamptz,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function teamflow_private.ingest_github_review(uuid,uuid,uuid,text,bigint,bigint,uuid,text,text,text,timestamptz,timestamptz,text,boolean) to service_role;
create function public.tf_ingest_github_review(w uuid,t uuid,reviewer uuid,repo text,pull_number bigint,github_reviewer_id bigint,delivery_id uuid,tracked text,branch text,review_status text,requested timestamptz,observed timestamptz,pr_state text,is_draft boolean)
returns jsonb language sql security invoker set search_path='' as $$ select teamflow_private.ingest_github_review(w,t,reviewer,repo,pull_number,github_reviewer_id,delivery_id,tracked,branch,review_status,requested,observed,pr_state,is_draft) $$;
revoke all on function public.tf_ingest_github_review(uuid,uuid,uuid,text,bigint,bigint,uuid,text,text,text,timestamptz,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.tf_ingest_github_review(uuid,uuid,uuid,text,bigint,bigint,uuid,text,text,text,timestamptz,timestamptz,text,boolean) to service_role;

-- Convert deterministic business conflicts at the public RPC boundary, not genuine serialization failures.
create or replace function public.tf_mutate(w uuid, operation text, body jsonb, request_key text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 return teamflow_private.mutate(w,operation,body,request_key);
exception when serialization_failure then
 if SQLERRM in ('Task changed; regenerate proposal','Idempotency key reused','Proposal already decided','Plan changed; regenerate proposal','Evidence changed or expired','Plan changed','Task changed','Event key reused') then
  raise exception 'Plan or evidence changed; refresh and retry' using errcode='PT409';
 end if;
 raise;
end $$;
