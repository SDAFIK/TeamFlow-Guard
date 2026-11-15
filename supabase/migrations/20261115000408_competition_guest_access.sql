-- Native anonymous Auth sessions use the actual personal-demo workspace.
-- All anonymous identities remain restricted to one fictional workspace.
create or replace function teamflow_private.member_role(w uuid) returns text
language sql stable security definer set search_path='' as $$
 select m.role from public.tf_memberships m join public.tf_workspaces p on p.id=m.workspace_id
 join auth.users u on u.id=m.user_id
 where m.workspace_id=w and m.user_id=(select auth.uid()) and not m.demo_persona
 and (not u.is_anonymous or (u.created_at>now()-interval '2 hours' and p.demo_owner_id=u.id))
$$;
create function teamflow_private.guard_guest_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); wid uuid; owner_id uuid; fictional boolean;
begin
 if not exists(select 1 from auth.users where id=actor and is_anonymous) then
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
 end if;
 if TG_OP='DELETE' then wid:=OLD.id;owner_id:=OLD.demo_owner_id;fictional:=OLD.is_demo;
 else wid:=NEW.id;owner_id:=NEW.demo_owner_id;fictional:=NEW.is_demo; end if;
 if owner_id is distinct from actor or not fictional or not exists(select 1 from auth.users where id=actor and is_anonymous and created_at>now()-interval '2 hours') then
  raise exception 'Guest access is restricted to an active personal demo' using errcode='42501';
 end if;
 if TG_OP='UPDATE' and OLD.demo_owner_id is distinct from actor then raise exception 'Guest access denied' using errcode='42501'; end if;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
revoke all on function teamflow_private.guard_guest_workspace() from public,anon,authenticated,service_role;
create trigger tf_guest_workspace_guard before insert or update or delete on public.tf_workspaces for each row execute function teamflow_private.guard_guest_workspace();

create function teamflow_private.guard_guest_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users u where u.id=NEW.user_id and u.is_anonymous) and not exists(
  select 1 from public.tf_workspaces p where p.id=NEW.workspace_id and p.demo_owner_id=NEW.user_id and p.is_demo and NEW.role='owner' and not NEW.demo_persona
 ) then raise exception 'Anonymous identity cannot join real workspaces' using errcode='42501'; end if;
 return NEW;
end $$;
revoke all on function teamflow_private.guard_guest_membership() from public,anon,authenticated,service_role;
create trigger tf_guest_membership_guard before insert or update on public.tf_memberships for each row execute function teamflow_private.guard_guest_membership();

-- Bound public provisioning even if a caller invokes Auth directly.
create function teamflow_private.guard_guest_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not NEW.is_anonymous then return NEW; end if;
 perform pg_advisory_xact_lock(hashtext('teamflow-guest-signup'));
 if (select count(*) from auth.users where is_anonymous and created_at>now()-interval '1 hour')>=60
 or (select count(*) from auth.users where is_anonymous and created_at>now()-interval '24 hours')>=200
 or (select count(*) from auth.users where is_anonymous)>=1000 then
  raise exception 'Guest session limit reached' using errcode='P0429';
 end if;
 return NEW;
end $$;
revoke all on function teamflow_private.guard_guest_signup() from public,anon,authenticated,service_role;
create trigger tf_guest_signup_guard before insert on auth.users for each row execute function teamflow_private.guard_guest_signup();

-- Independent budget ledger survives personal demo resets. No prompt, identity
-- profile, or response data is recorded here. Provider rate limits still apply.
create table teamflow_private.tf_guest_ai_budget(actor_id uuid not null,created_at timestamptz not null default now());
alter table teamflow_private.tf_guest_ai_budget enable row level security;
revoke all on teamflow_private.tf_guest_ai_budget from public,anon,authenticated,service_role;
create index tf_guest_ai_actor on teamflow_private.tf_guest_ai_budget(actor_id);
create index tf_guest_ai_time on teamflow_private.tf_guest_ai_budget(created_at);
create function teamflow_private.guard_guest_ai() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users u where u.id=NEW.actor_id and u.is_anonymous) then return NEW; end if;
 perform pg_advisory_xact_lock(hashtext('teamflow-guest-ai-budget'));
 if (select count(*) from teamflow_private.tf_guest_ai_budget where actor_id=NEW.actor_id)>=3
 or (select count(*) from teamflow_private.tf_guest_ai_budget where created_at>now()-interval '1 hour')>=60
 or (select count(*) from teamflow_private.tf_guest_ai_budget where created_at>now()-interval '24 hours')>=150 then
  raise exception 'Guest Gemini request limit reached' using errcode='P0429';
 end if;
 insert into teamflow_private.tf_guest_ai_budget(actor_id) values(NEW.actor_id);
 return NEW;
end $$;
revoke all on function teamflow_private.guard_guest_ai() from public,anon,authenticated,service_role;
create trigger tf_guest_ai_guard before insert on public.tf_analysis for each row execute function teamflow_private.guard_guest_ai();

create or replace function teamflow_private.guard_archived_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
declare wid uuid; archived timestamptz; guest_owner uuid;
begin
 wid:=case when TG_OP='DELETE' then OLD.workspace_id else NEW.workspace_id end;
 select p.archived_at,p.demo_owner_id into archived,guest_owner from public.tf_workspaces p where p.id=wid for share;
 if exists(select 1 from auth.users u where u.id=auth.uid() and u.is_anonymous and (u.created_at<=now()-interval '2 hours' or guest_owner is distinct from u.id)) then raise exception 'Guest workspace unavailable' using errcode='42501'; end if;
 if archived is not null then
  raise exception 'Workspace archived; restore before changing it' using errcode='PT409';
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;

create or replace function teamflow_private.workspace_lifecycle(w uuid, operation text, confirmed_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ws public.tf_workspaces; actor_name text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from auth.users u where u.id=actor and ((not u.is_anonymous and u.email_confirmed_at is not null) or (u.is_anonymous and u.created_at>now()-interval '2 hours'))) then
  raise exception 'Verified email required' using errcode='42501';
 end if;
 select * into ws from public.tf_workspaces where id=w for update;
 if not found or (exists(select 1 from auth.users u where u.id=actor and u.is_anonymous) and ws.demo_owner_id is distinct from actor) then raise exception 'Workspace unavailable' using errcode='42501'; end if;
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

create or replace function teamflow_private.personal_demo(operation text, w uuid default null, confirmed_name text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); email_address text; actor_name text; ws public.tf_workspaces; existing public.tf_workspaces;
 maya uuid:=gen_random_uuid(); ryan uuid:=gen_random_uuid(); sara uuid:=gen_random_uuid(); daniel uuid:=gen_random_uuid(); nora uuid:=gen_random_uuid();
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); e uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); h uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); k uuid:=gen_random_uuid();
 stamp timestamptz:=clock_timestamp();
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select case when u.is_anonymous then 'guest-'||actor::text||'@fictional.invalid' else lower(u.email) end into email_address from auth.users u where u.id=actor and ((u.is_anonymous and u.created_at>now()-interval '2 hours') or (not u.is_anonymous and u.email_confirmed_at is not null));
 if email_address is null then raise exception 'Verified email required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(actor::text));
 select m.name into actor_name from public.tf_memberships m join public.tf_workspaces p on p.id=m.workspace_id where m.user_id=actor and not m.demo_persona and not p.is_demo order by p.created_at limit 1;
 actor_name:=case when exists(select 1 from auth.users u where u.id=actor and u.is_anonymous) then 'Guest judge' else coalesce(actor_name,split_part(email_address,'@',1)) end;
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

