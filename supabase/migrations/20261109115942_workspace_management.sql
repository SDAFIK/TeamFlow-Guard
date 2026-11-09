create table public.tf_invites (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.tf_workspaces(id),
 email text not null check(length(email) between 3 and 254), role text not null check(role in ('manager','member','viewer')),
 token_hash text not null unique check(length(token_hash)=64), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, revoked_at timestamptz
);
create index tf_invites_workspace on public.tf_invites(workspace_id,created_at desc);
alter table public.tf_invites enable row level security;
revoke all on public.tf_invites from public,anon,authenticated;
grant select(id,workspace_id,email,role,created_at,expires_at,accepted_at,revoked_at) on public.tf_invites to authenticated;
create policy managers_read on public.tf_invites for select to authenticated using(teamflow_private.member_role(workspace_id) in ('owner','manager'));

create function teamflow_private.workspace_write(w uuid, operation text, body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); email_address text; display_name text; ws public.tf_workspaces; m public.tf_memberships;
 inv public.tf_invites; target public.tf_memberships; previous jsonb; result jsonb; new_role text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select lower(email) into email_address from auth.users where id=actor and email_confirmed_at is not null;
 if email_address is null then raise exception 'Verified email required' using errcode='42501'; end if;
 if operation='create' then
  perform pg_advisory_xact_lock(hashtext(actor::text));
  if (select count(*) from public.tf_memberships where user_id=actor and role='owner')>=10 then raise exception 'Workspace limit reached' using errcode='22023'; end if;
  if coalesce(length(trim(body->>'name')),0) not between 2 and 100 or coalesce(length(trim(body->>'display_name')),0) not between 1 and 80 then raise exception 'Invalid name' using errcode='22023'; end if;
  insert into public.tf_workspaces(name,description) values(trim(body->>'name'),left(coalesce(body->>'description',''),1000)) returning * into ws;
  insert into public.tf_memberships(workspace_id,user_id,role,name,email) values(ws.id,actor,'owner',trim(body->>'display_name'),email_address) returning * into m;
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version) values(ws.id,actor,m.name,'workspace.created','Workspace created',ws.plan_version);
  return to_jsonb(ws);
 end if;
 if operation='join' then
  select * into inv from public.tf_invites where token_hash=body->>'token_hash';
  if not found or inv.email<>email_address or inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  select * into ws from public.tf_workspaces where id=inv.workspace_id for update;
  select * into inv from public.tf_invites where id=inv.id for update;
  if inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if inv.accepted_at is not null then
   if exists(select 1 from public.tf_memberships where workspace_id=ws.id and user_id=actor) then return to_jsonb(ws); end if;
   raise exception 'Invitation already used' using errcode='42501';
  end if;
  if coalesce(length(trim(body->>'display_name')),0) not between 1 and 80 then raise exception 'Name required' using errcode='22023'; end if;
  insert into public.tf_memberships(workspace_id,user_id,role,name,email) values(ws.id,actor,inv.role,trim(body->>'display_name'),email_address) on conflict do nothing;
  update public.tf_invites set accepted_at=now() where id=inv.id;
  insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version) values(ws.id,actor,trim(body->>'display_name'),'member.joined','Invitation accepted',ws.plan_version);
  return to_jsonb(ws);
 end if;
 select * into ws from public.tf_workspaces where id=w for update;
 select * into m from public.tf_memberships where workspace_id=w and user_id=actor;
 if not found or m.role not in ('owner','manager') then raise exception 'Manager access required' using errcode='42501'; end if;
 if operation='settings' then
  if (body->>'base_plan_version')::int is distinct from ws.plan_version then raise exception 'Workspace changed' using errcode='40001'; end if;
  if coalesce(length(trim(body->>'name')),0) not between 2 and 100 or coalesce(length(body->>'description'),0)>1000 or coalesce(length(trim(body->>'tracked_branch')),0) not between 1 and 100 or coalesce((body->>'review_threshold_hours')::int,0) not between 1 and 168 then raise exception 'Invalid settings' using errcode='22023'; end if;
  previous:=to_jsonb(ws);
  update public.tf_workspaces set name=trim(body->>'name'),description=coalesce(body->>'description',''),tracked_branch=trim(body->>'tracked_branch'),review_threshold_hours=(body->>'review_threshold_hours')::int,plan_version=plan_version+1 where id=w returning * into ws;
  result:=to_jsonb(ws);
 elsif operation='invite' then
  new_role:=body->>'role';
  if new_role is null or new_role not in ('manager','member','viewer') or (new_role='manager' and m.role<>'owner') then raise exception 'Role not allowed' using errcode='42501'; end if;
  if coalesce(body->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or coalesce(body->>'token_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  if (select count(*) from public.tf_invites where workspace_id=w and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached' using errcode='P0429'; end if;
  insert into public.tf_invites(workspace_id,email,role,token_hash,created_by) values(w,lower(body->>'email'),new_role,body->>'token_hash',actor) returning * into inv;
  result:=to_jsonb(inv)-'token_hash';
 elsif operation='revoke_invite' then
  update public.tf_invites set revoked_at=now() where id=(body->>'invite_id')::uuid and workspace_id=w and accepted_at is null returning * into inv;
  if not found then raise exception 'Invitation unavailable' using errcode='22023'; end if;
  result:=to_jsonb(inv)-'token_hash';
 elsif operation='role' then
  if m.role<>'owner' then raise exception 'Owner required' using errcode='42501'; end if;
  new_role:=body->>'role';
  if new_role is null or new_role not in ('manager','member','viewer') then raise exception 'Invalid role' using errcode='22023'; end if;
  select * into target from public.tf_memberships where workspace_id=w and user_id=(body->>'user_id')::uuid;
  if not found or target.role='owner' then raise exception 'Owner membership is protected' using errcode='42501'; end if;
  if new_role='viewer' and exists(select 1 from public.tf_tasks where workspace_id=w and not archived and (owner_id=target.user_id or reviewer_id=target.user_id)) then raise exception 'Reassign tasks before changing to viewer' using errcode='22023'; end if;
  previous:=to_jsonb(target);
  update public.tf_memberships set role=new_role where workspace_id=w and user_id=target.user_id returning to_jsonb(tf_memberships) into result;
  update public.tf_workspaces set plan_version=plan_version+1 where id=w returning * into ws;
 else raise exception 'Unknown operation' using errcode='22023'; end if;
 insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version,changes) values(w,actor,m.name,'workspace.'||operation,'Workspace '||replace(operation,'_',' '),ws.plan_version,jsonb_build_array(jsonb_build_object('before',previous,'after',result)));
 return result;
end $$;
revoke all on function teamflow_private.workspace_write(uuid,text,jsonb) from public,anon;
grant execute on function teamflow_private.workspace_write(uuid,text,jsonb) to authenticated;
create function public.tf_workspace_write(w uuid, operation text, body jsonb) returns jsonb language sql security invoker set search_path='' as $$ select teamflow_private.workspace_write(w,operation,body) $$;
revoke all on function public.tf_workspace_write(uuid,text,jsonb) from public,anon;
grant execute on function public.tf_workspace_write(uuid,text,jsonb) to authenticated;
