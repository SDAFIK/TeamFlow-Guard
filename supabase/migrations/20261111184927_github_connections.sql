-- Stores a workspace's public GitHub repository reference. Never stores credentials.
alter table public.tf_workspaces
  add column github_repository text
  constraint tf_github_repository_public_slug
  check (github_repository is null or github_repository ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$');

create function teamflow_private.link_github(w uuid, repo text, expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_member public.tf_memberships;
  ws public.tf_workspaces;
  old_repository text;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into actor_member from public.tf_memberships
    where workspace_id = w and user_id = actor;
  if not found or actor_member.role not in ('owner', 'manager') then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if repo is not null and (length(repo) > 140 or repo !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'Invalid repository reference' using errcode = '22023';
  end if;
  select * into ws from public.tf_workspaces where id = w for update;
  if not found then raise exception 'Workspace unavailable' using errcode = '42501'; end if;
  if ws.plan_version is distinct from expected_version then
    raise exception 'Workspace changed' using errcode = '40001';
  end if;
  if ws.github_repository is not distinct from repo then return to_jsonb(ws); end if;
  old_repository := ws.github_repository;
  update public.tf_workspaces
    set github_repository = repo, plan_version = plan_version + 1
    where id = w returning * into ws;
  insert into public.tf_audit(workspace_id, actor_id, actor_name, kind, summary, plan_version, changes)
    values(w, actor, actor_member.name, 'workspace.github',
      case when repo is null then 'Public GitHub repository disconnected' else 'Public GitHub repository linked' end,
      ws.plan_version, jsonb_build_array(jsonb_build_object('before', old_repository, 'after', repo)));
  return to_jsonb(ws);
end $$;

revoke all on function teamflow_private.link_github(uuid,text,integer) from public, anon, authenticated;
grant execute on function teamflow_private.link_github(uuid,text,integer) to authenticated;

create function public.tf_github_link(w uuid, repo text, expected_version integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select teamflow_private.link_github(w, repo, expected_version)
$$;
revoke all on function public.tf_github_link(uuid,text,integer) from public, anon;
grant execute on function public.tf_github_link(uuid,text,integer) to authenticated;
