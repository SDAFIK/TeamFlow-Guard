-- Stage 2: private, per-user fictional team. No synthetic Auth users or credentials.
alter table public.tf_workspaces add column demo_owner_id uuid references auth.users(id);
alter table public.tf_workspaces add constraint tf_personal_demo_only check(demo_owner_id is null or (is_demo and github_repository is null));
create unique index tf_one_personal_demo on public.tf_workspaces(demo_owner_id) where demo_owner_id is not null;

-- Keep real memberships linked to Auth, while allowing explicitly fictional
-- non-login personas to participate in existing task/graph/capacity workflows.
alter table public.tf_memberships add column demo_persona boolean not null default false;
alter table public.tf_memberships add column auth_user_id uuid generated always as
 (case when demo_persona then null else user_id end) stored references auth.users(id);
alter table public.tf_memberships drop constraint tf_memberships_user_id_fkey;
alter table public.tf_memberships add constraint tf_demo_persona_role check(not demo_persona or role='member');

create function teamflow_private.guard_demo_membership() returns trigger
language plpgsql security definer set search_path='' as $$
declare demo_owner uuid;
begin
 select p.demo_owner_id into demo_owner from public.tf_workspaces p where p.id=NEW.workspace_id;
 if NEW.demo_persona then
  if demo_owner is null or NEW.user_id=demo_owner or exists(select 1 from auth.users u where u.id=NEW.user_id) then
   raise exception 'Invalid fictional persona' using errcode='42501';
  end if;
 elsif demo_owner is not null and (NEW.user_id<>demo_owner or NEW.role<>'owner') then
  raise exception 'Personal demo is private; use a real workspace to invite teammates' using errcode='42501';
 end if;
 if TG_OP='UPDATE' and NEW.demo_persona is distinct from OLD.demo_persona then
  raise exception 'Membership identity type cannot change' using errcode='42501';
 end if;
 return NEW;
end $$;
revoke all on function teamflow_private.guard_demo_membership() from public,anon,authenticated,service_role;
create trigger tf_demo_membership_guard before insert or update on public.tf_memberships
 for each row execute function teamflow_private.guard_demo_membership();

-- Fictional identifiers never authorize a session.
create or replace function teamflow_private.member_role(w uuid) returns text
language sql stable security definer set search_path='' as $$
 select role from public.tf_memberships where workspace_id=w and user_id=(select auth.uid()) and not demo_persona
$$;

create function teamflow_private.guard_personal_demo_invites() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.tf_workspaces p where p.id=NEW.workspace_id and p.demo_owner_id is not null) then
  raise exception 'Personal demo cannot send invitations' using errcode='42501';
 end if;
 return NEW;
end $$;
revoke all on function teamflow_private.guard_personal_demo_invites() from public,anon,authenticated,service_role;
create trigger tf_personal_demo_invites before insert on public.tf_invites
 for each row execute function teamflow_private.guard_personal_demo_invites();

create function teamflow_private.personal_demo(operation text, w uuid default null, confirmed_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); email_address text; actor_name text; ws public.tf_workspaces; existing public.tf_workspaces;
 maya uuid:=gen_random_uuid(); ryan uuid:=gen_random_uuid(); sara uuid:=gen_random_uuid(); daniel uuid:=gen_random_uuid(); nora uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); e uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); h uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); k uuid:=gen_random_uuid();
 stamp timestamptz:=clock_timestamp();
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select lower(u.email) into email_address from auth.users u where u.id=actor and u.email_confirmed_at is not null;
 if email_address is null then raise exception 'Verified email required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select m.name into actor_name from public.tf_memberships m join public.tf_workspaces p on p.id=m.workspace_id where m.user_id=actor and not m.demo_persona and not p.is_demo order by p.created_at limit 1;
 actor_name:=coalesce(actor_name,split_part(email_address,'@',1));
 select * into existing from public.tf_workspaces p where p.demo_owner_id=actor for update;
 if operation='open' then
  if w is not null or confirmed_name is not null then raise exception 'Invalid demo request' using errcode='22023'; end if;
  if existing.id is not null then
   if existing.archived_at is not null then perform teamflow_private.workspace_lifecycle(existing.id,'restore',null); end if;
   return (select to_jsonb(p) from public.tf_workspaces p where p.id=existing.id);
  end if;
 elsif operation='reset' then
  if existing.id is null or existing.id is distinct from w then raise exception 'Personal demo unavailable' using errcode='42501'; end if;
  if confirmed_name is distinct from existing.name then raise exception 'Workspace name does not match' using errcode='22023'; end if;
  -- Replace only this caller's private demo, atomically, using Stage 1 cleanup.
  perform teamflow_private.workspace_lifecycle(existing.id,'delete',confirmed_name);
 else raise exception 'Unknown demo operation' using errcode='22023'; end if;
 if (select count(*) from public.tf_memberships m where m.user_id=actor and m.role='owner')>=10 then
  raise exception 'Workspace limit reached' using errcode='22023';
 end if;
 insert into public.tf_workspaces(name,description,is_demo,fixture_label,demo_owner_id)
 values('Checkout Launch · Personal demo','Fictional software release: one real signed-in owner and five simulated teammates. No external GitHub events or real teammate accounts.',true,'Personal demo · fictional team and evidence',actor) returning * into ws;
 insert into public.tf_memberships(workspace_id,user_id,role,name,email,specialty,available_hours,availability_start,availability_end,demo_persona)
 values
 (ws.id,actor,'owner',actor_name,email_address,'Engineering lead',32,stamp-interval '1 day',stamp+interval '7 days',false),
 (ws.id,maya,'member','Maya Chen','maya@fictional.invalid','Frontend engineering',24,stamp-interval '1 day',stamp+interval '7 days',true),
 (ws.id,ryan,'member','Ryan Patel','ryan@fictional.invalid','Backend engineering',8,stamp-interval '1 day',stamp+interval '7 days',true),
 (ws.id,sara,'member','Sara Ahmed','sara@fictional.invalid','Quality assurance',36,stamp-interval '1 day',stamp+interval '7 days',true),
 (ws.id,daniel,'member','Daniel Kim','daniel@fictional.invalid','DevOps engineering',32,stamp-interval '1 day',stamp+interval '7 days',true),
 (ws.id,nora,'member','Nora Wilson','nora@fictional.invalid','UI/UX design',28,stamp-interval '1 day',stamp+interval '7 days',true);
 insert into public.tf_tasks(id,workspace_id,key,title,description,status,owner_id,reviewer_id,priority,position,estimate_hours,due_at)
 values
 (a,ws.id,'AUTH-142','Authentication API','Fictional authentication pipeline failure blocks checkout.','blocked',ryan,sara,'critical',0,16,stamp+interval '2 days'),
 (b,ws.id,'LOGIN-210','Login experience','Integrate the authentication contract.','in_progress',maya,nora,'high',1,12,stamp+interval '3 days'),
 (c,ws.id,'CHK-318','Checkout UI','Connect account session and checkout form.','todo',maya,nora,'high',2,12,stamp+interval '4 days'),
 (d,ws.id,'PAY-104','Payment API','Implement payment sandbox contract.','in_progress',ryan,daniel,'high',3,12,stamp+interval '3 days'),
 (e,ws.id,'QA-105','Checkout acceptance','Run integration and accessibility checks.','todo',sara,actor,'normal',4,8,stamp+interval '5 days'),
 (f,ws.id,'REL-106','Release candidate','Prepare deployment and release approval.','todo',daniel,actor,'high',5,8,stamp+interval '6 days'),
 (g,ws.id,'UX-107','Checkout design review','Review mobile interactions and validation states.','done',nora,maya,'normal',6,8,stamp+interval '1 day'),
 (h,ws.id,'CI-108','Repair CI pipeline','Investigate failing authentication checks.','in_progress',daniel,sara,'high',7,12,stamp+interval '2 days'),
 (j,ws.id,'QA-109','Payment regression tests','Verify edge cases and sandbox payment flow.','todo',sara,daniel,'normal',8,8,stamp+interval '4 days'),
 (k,ws.id,'PLAN-110','Release risk review','Review proposed recovery before approving changes.','todo',actor,sara,'normal',9,6,stamp+interval '5 days');
 insert into public.tf_dependencies(workspace_id,predecessor_id,successor_id) values
 (ws.id,a,b),(ws.id,b,c),(ws.id,c,e),(ws.id,d,j),(ws.id,j,e),(ws.id,e,f),(ws.id,h,f),(ws.id,g,c),(ws.id,k,f);
 insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin,observed_at,payload) values
 (ws.id,a,'seed:ci_failure','ci_failure','Authentication CI failed','Fictional failed CI run mapped to AUTH-142.','seed',stamp,jsonb_build_object('branch','main','tracked_branch','main','conclusion','failure')),
 (ws.id,a,'seed:dependency','dependency','Authentication API blocked','Fictional blocker affecting login, checkout, QA and release.','seed',stamp,'{}'),
 (ws.id,a,'seed:review_delay','review_delay','Authentication PR awaiting review','Fictional open PR waiting 48 hours; no real GitHub repository.','seed',stamp,jsonb_build_object('state','open','is_draft',false,'reviewer_id',sara,'review_requested_at',stamp-interval '48 hours')),
 (ws.id,a,'seed:capacity','capacity','Backend availability constraint','Fictional reported availability: 8 hours against 16 estimated hours.','seed',stamp,'{}');
 insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version)
 values(ws.id,actor,actor_name,'workspace.created','Personal fictional demo initialized',1);
 return to_jsonb(ws);
end $$;
revoke all on function teamflow_private.personal_demo(text,uuid,text) from public,anon,service_role;
grant execute on function teamflow_private.personal_demo(text,uuid,text) to authenticated;
create function public.tf_personal_demo(operation text,w uuid default null,confirmed_name text default null) returns jsonb
language sql security invoker set search_path='' as $$
 select teamflow_private.personal_demo(operation,w,confirmed_name)
$$;
revoke all on function public.tf_personal_demo(text,uuid,text) from public,anon,service_role;
grant execute on function public.tf_personal_demo(text,uuid,text) to authenticated;
