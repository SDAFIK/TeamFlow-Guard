-- Workspace-managed mappings, scoped to an already administrator-authorized App installation.
-- Add-only: never remap historical evidence or modify an approved plan.
create table teamflow_private.tf_github_workspace_mappings (
 workspace_id uuid not null references public.tf_workspaces(id),
 repository text not null check(repository ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$'),
 installation_id bigint not null check(installation_id>0 and installation_id<=9007199254740991),
 repository_id bigint not null check(repository_id>0 and repository_id<=9007199254740991),
 kind text not null check(kind in ('ci','review')),
 external_id bigint not null check(external_id>0 and external_id<=9007199254740991),
 task_id uuid not null, reviewer_id uuid, github_reviewer_id bigint,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(workspace_id,kind,external_id),
 foreign key(workspace_id,task_id) references public.tf_tasks(workspace_id,id),
 foreign key(workspace_id,reviewer_id) references public.tf_memberships(workspace_id,user_id),
 check((kind='ci' and reviewer_id is null and github_reviewer_id is null) or
       (kind='review' and reviewer_id is not null and github_reviewer_id is not null and github_reviewer_id between 1 and 9007199254740991))
);
create unique index tf_github_mapping_review_task on teamflow_private.tf_github_workspace_mappings(workspace_id,task_id) where kind='review';
alter table teamflow_private.tf_github_workspace_mappings enable row level security;
revoke all on teamflow_private.tf_github_workspace_mappings from public,anon,authenticated,service_role;
grant usage on schema teamflow_private to service_role;

create function teamflow_private.github_mapping_list(w uuid,repo text,installation bigint,repository bigint)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'ci',coalesce(jsonb_agg(jsonb_build_object('workspace_id',m.workspace_id,'workflow_id',m.external_id,'task_id',m.task_id) order by m.external_id) filter(where m.kind='ci'),'[]'::jsonb),
  'reviews',coalesce(jsonb_agg(jsonb_build_object('workspace_id',m.workspace_id,'pull_number',m.external_id,'task_id',m.task_id,'reviewer_id',m.reviewer_id,'github_reviewer_id',m.github_reviewer_id) order by m.external_id) filter(where m.kind='review'),'[]'::jsonb))
 from teamflow_private.tf_github_workspace_mappings m
 join public.tf_workspaces ws on ws.id=m.workspace_id and not ws.is_demo
 where m.workspace_id=w and lower(m.repository)=lower(repo) and m.installation_id=installation and m.repository_id=repository
$$;
create function teamflow_private.github_mapping_create(w uuid,actor uuid,repo text,installation bigint,repository bigint,mapping_kind text,external bigint,t uuid,reviewer uuid,github_reviewer bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ws public.tf_workspaces; member_row public.tf_memberships; task_row public.tf_tasks;
begin
 select * into ws from public.tf_workspaces where id=w for update;
 if not found or ws.is_demo then raise exception 'Workspace unavailable' using errcode='42501'; end if;
 select * into member_row from public.tf_memberships where workspace_id=w and user_id=actor;
 if not found or member_row.role not in ('owner','manager') then raise exception 'Manager required' using errcode='42501'; end if;
 if repo is null or repo !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' or position('..' in repo)>0 or installation is null or installation not between 1 and 9007199254740991 or repository is null or repository not between 1 and 9007199254740991 or external is null or external not between 1 and 9007199254740991 or mapping_kind is null or mapping_kind not in ('ci','review') then raise exception 'Invalid mapping' using errcode='22023'; end if;
 select * into task_row from public.tf_tasks where workspace_id=w and id=t and not archived;
 if not found or task_row.status='done' then raise exception 'Unfinished mapped task required' using errcode='22023'; end if;
 if (mapping_kind='ci' and (reviewer is not null or github_reviewer is not null)) or
    (mapping_kind='review' and (reviewer is null or github_reviewer is null or github_reviewer not between 1 and 9007199254740991 or not exists(select 1 from public.tf_memberships m where m.workspace_id=w and m.user_id=reviewer and m.role<>'viewer'))) then raise exception 'Invalid reviewer mapping' using errcode='22023'; end if;
 if (select count(*) from teamflow_private.tf_github_workspace_mappings where workspace_id=w)>=100 then raise exception 'Mapping limit reached' using errcode='22023'; end if;
 insert into teamflow_private.tf_github_workspace_mappings(workspace_id,repository,installation_id,repository_id,kind,external_id,task_id,reviewer_id,github_reviewer_id,created_by)
 values(w,repo,installation,repository,mapping_kind,external,t,reviewer,github_reviewer,actor);
 insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version)
 values(w,actor,member_row.name,'github.mapping.created',mapping_kind||' #'||external||' mapped to '||task_row.key,ws.plan_version);
 return jsonb_build_object('status','created','plan_version',ws.plan_version);
end $$;
revoke all on function teamflow_private.github_mapping_list(uuid,text,bigint,bigint),teamflow_private.github_mapping_create(uuid,uuid,text,bigint,bigint,text,bigint,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function teamflow_private.github_mapping_list(uuid,text,bigint,bigint),teamflow_private.github_mapping_create(uuid,uuid,text,bigint,bigint,text,bigint,uuid,uuid,bigint) to service_role;
create function public.tf_github_mapping_list(w uuid,repo text,installation bigint,repository bigint)
returns jsonb language sql stable security invoker set search_path='' as $$ select teamflow_private.github_mapping_list(w,repo,installation,repository) $$;
create function public.tf_github_mapping_create(w uuid,actor uuid,repo text,installation bigint,repository bigint,mapping_kind text,external bigint,t uuid,reviewer uuid,github_reviewer bigint)
returns jsonb language sql security invoker set search_path='' as $$ select teamflow_private.github_mapping_create(w,actor,repo,installation,repository,mapping_kind,external,t,reviewer,github_reviewer) $$;
revoke all on function public.tf_github_mapping_list(uuid,text,bigint,bigint),public.tf_github_mapping_create(uuid,uuid,text,bigint,bigint,text,bigint,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.tf_github_mapping_list(uuid,text,bigint,bigint),public.tf_github_mapping_create(uuid,uuid,text,bigint,bigint,text,bigint,uuid,uuid,bigint) to service_role;
