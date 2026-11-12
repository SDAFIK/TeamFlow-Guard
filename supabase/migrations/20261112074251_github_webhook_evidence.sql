-- Stage 7: service-only, idempotent CI evidence ingestion. No task or plan mutations.
create function public.tf_ingest_github_ci(w uuid, t uuid, repo text, workflow_id bigint, run_id bigint, attempt integer, branch text, conclusion text, observed timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces; latest uuid; inserted uuid; source text; task_key text;
begin
 if repo is null or repo !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' or workflow_id is null or workflow_id<=0 or run_id is null or run_id<=0 or attempt is null or attempt<=0 or branch is null or length(branch) not between 1 and 255 or conclusion is null or conclusion not in ('success','failure','timed_out') or observed is null or observed>now()+interval '5 minutes' then
  raise exception 'Invalid CI evidence' using errcode='22023';
 end if;
 select * into ws from public.tf_workspaces where id=w for update;
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
revoke all on function public.tf_ingest_github_ci(uuid,uuid,text,bigint,bigint,integer,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.tf_ingest_github_ci(uuid,uuid,text,bigint,bigint,integer,text,text,timestamptz) to service_role;
