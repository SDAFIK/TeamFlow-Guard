"""Run the production SQL against ONLY the disposable local test database.

Auth.uid() is shimmed from a JWT subject, never presented as hosted Auth proof.
Every change, including schema/role scaffolding, rolls back at the end.
"""
import json
import os
import runpy
from pathlib import Path
from uuid import uuid4
import psycopg
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / 'api/.env')
url = make_url(os.environ['TEST_DATABASE_URL'])
if url.database not in ('teamflow_test', 'teamflow_test_utf8') or url.host not in ('localhost','127.0.0.1'):
    raise SystemExit('Refusing non-disposable database')
passed = []
with psycopg.connect(host=url.host, port=url.port, user=url.username, password=url.password, dbname=url.database, connect_timeout=5, options='-c statement_timeout=15000') as db:
    try:
        db.execute("CREATE SCHEMA IF NOT EXISTS auth")
        db.execute("CREATE TABLE IF NOT EXISTS auth.users(id uuid primary key)")
        db.execute("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz")
        db.execute("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$")
        db.execute("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$")
        db.execute('GRANT USAGE ON SCHEMA public,auth TO authenticated,anon')
        db.execute('GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon')
        if not db.execute("select exists(select 1 from pg_roles where rolname='service_role')").fetchone()[0]:
            db.execute("CREATE ROLE service_role NOLOGIN")
        db.execute("GRANT USAGE ON SCHEMA public TO service_role")
        for file in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            db.execute(file.read_text(encoding='utf-8'))
        passed.append('migration applies')
        w, other, owner, member, viewer, outsider, task, successor = [str(uuid4()) for _ in range(8)]
        for who in (owner,member,viewer,outsider): db.execute('insert into auth.users(id,email,email_confirmed_at) values(%s,%s,now())',(who,who+'@example.test'))
        for wid in (w,other): db.execute("insert into public.tf_workspaces(id,name,is_demo) values(%s,'Isolated test',true)",(wid,))
        for wid,who,role in [(w,owner,'owner'),(w,member,'member'),(w,viewer,'viewer'),(other,outsider,'owner')]:
            db.execute('insert into public.tf_memberships(workspace_id,user_id,role,name,email) values(%s,%s,%s,%s,%s)',(wid,who,role,role,role+'@example.test'))
        for tid,key,position in [(task,'T-1',0),(successor,'T-2',1)]:
            db.execute('insert into public.tf_tasks(id,workspace_id,key,title,owner_id,position) values(%s,%s,%s,%s,%s,%s)',(tid,w,key,key,member,position))
        db.execute('insert into public.tf_dependencies values(%s,%s,%s)',(w,task,successor))
        def identity(who):
            db.execute('RESET ROLE')
            db.execute("select set_config('request.jwt.claim.sub',%s,true)",(who,))
            db.execute('SET LOCAL ROLE authenticated')
        def denied(name, fn, code=None):
            db.execute('SAVEPOINT negative')
            try: fn()
            except psycopg.Error as e:
                db.execute('ROLLBACK TO SAVEPOINT negative')
                if code and e.sqlstate != code: raise AssertionError(f'{name}: expected {code}, received {e.sqlstate}') from None
                passed.append(name)
            else: raise AssertionError(name+' unexpectedly allowed')
        def rpc(operation, body, key=''):
            return db.execute('select public.tf_mutate(%s,%s,%s::jsonb,%s)',(w,operation,json.dumps(body),key)).fetchone()[0]
        identity(outsider)
        assert db.execute('select public.tf_snapshot(%s)',(w,)).fetchone()[0] is None
        passed.append('cross-workspace read denied')
        denied('cross-workspace write denied',lambda:rpc('status',{'task_id':task,'expected_version':1,'status':'blocked'}),'42501')
        identity(viewer)
        assert len(db.execute('select public.tf_snapshot(%s)',(w,)).fetchone()[0]['tasks'])==2
        passed.append('viewer can inspect')
        for op in ('status','proposal','availability','replay','decision'):
            denied('viewer '+op+' denied',lambda op=op:rpc(op,{}),'42501')
        denied('direct task update denied',lambda:db.execute("update public.tf_tasks set priority='critical' where id=%s",(task,)),'42501')
        denied('audit insert denied',lambda:db.execute("insert into public.tf_audit(workspace_id,actor_id,actor_name,kind,summary,plan_version) values(%s,%s,'forged','forged','forged',1)",(w,viewer)),'42501')
        identity(owner)
        action={'task_id':task,'field':'priority','before':'normal','after':'critical'}
        proposal={'title':'Raise priority','explanation':'Test only','source':'manual','base_plan_version':1,'actions':[action]}
        p=rpc('proposal',proposal)
        denied('missing action field rejected',lambda:rpc('proposal',{**proposal,'actions':[{'task_id':task}]}),'22023')
        denied('missing action value rejected',lambda:rpc('proposal',{**proposal,'actions':[{'task_id':task,'field':'priority','before':'normal'}]}),'22023')
        denied('missing decision rejected',lambda:rpc('decision',{'proposal_id':p['id']},'missing-decision'),'22023')
        assert db.execute('select priority from public.tf_tasks where id=%s',(task,)).fetchone()[0]=='normal'
        passed.append('proposal cannot mutate task')
        identity(member)
        denied('member approval denied',lambda:rpc('decision',{'proposal_id':p['id'],'decision':'approve','base_plan_version':1},'test-denied'),'42501')
        identity(owner)
        result=rpc('decision',{'proposal_id':p['id'],'decision':'reject','base_plan_version':1},'reject-key')
        assert result['plan_version']==1
        assert db.execute('select priority from public.tf_tasks where id=%s',(task,)).fetchone()[0]=='normal'
        passed.append('rejection preserves task and version')
        p=rpc('proposal',proposal)
        decision={'proposal_id':p['id'],'decision':'approve','base_plan_version':1}
        result=rpc('decision',decision,'approve-key')
        assert rpc('decision',decision,'approve-key')==result
        assert result['plan_version']==2
        assert db.execute('select priority from public.tf_tasks where id=%s',(task,)).fetchone()[0]=='critical'
        passed.append('approval applies exactly once with durable receipt')
        denied('key reuse rejected',lambda:rpc('decision',{**decision,'decision':'reject'},'approve-key'),'PT409')
        denied('second approval rejected',lambda:rpc('decision',decision,'another-key'),'PT409')
        denied('missing version rejected',lambda:rpc('status',{'task_id':task,'status':'blocked'}),'PT409')
        denied('stale proposal rejected',lambda:rpc('proposal',proposal),'PT409')
        denied('cyclic dependency rejected',lambda:rpc('proposal',{**proposal,'base_plan_version':2,'actions':[{'task_id':task,'field':'dependency','before':None,'after':successor}]}),'22023')
        denied('cross-workspace reviewer rejected',lambda:rpc('proposal',{**proposal,'base_plan_version':2,'actions':[{'task_id':task,'field':'reviewer_id','before':None,'after':outsider}]}),'22023')
        denied('audit update denied',lambda:db.execute("update public.tf_audit set summary='tampered'"),'42501')
        denied('receipt delete denied',lambda:db.execute('delete from public.tf_receipts'),'42501')
        r=db.execute("select public.tf_analysis_begin(%s,'generation-key','fingerprint','test-model','test-v1')",(w,)).fetchone()[0]
        repeat=db.execute("select public.tf_analysis_begin(%s,'generation-key','fingerprint','test-model','test-v1')",(w,)).fetchone()[0]
        assert r['id']==repeat['id'] and repeat['existing']
        passed.append('generation reservation idempotent')
        denied('generation key mismatch',lambda:db.execute("select public.tf_analysis_begin(%s,'generation-key','changed','test-model','test-v1')",(w,)),'40001')
        db.execute('select public.tf_analysis_fail(%s,%s)',(w,r['id']))
        passed.append('failed analysis recorded')
        def task_write(op, body):
            return db.execute('select public.tf_task_write(%s,%s,%s::jsonb)',(w,op,json.dumps(body))).fetchone()[0]
        created=task_write('create',{'key':'NEW-1','title':'Follow-up','owner_id':member,'estimate_hours':2,'base_plan_version':2})
        passed.append('task creation persists')
        edited=task_write('edit',{'task_id':created['id'],'title':'Updated follow-up','expected_version':1,'base_plan_version':3})
        assert edited['title']=='Updated follow-up' and edited['version']==2
        passed.append('task edit versions and audit')
        archived=task_write('archive',{'task_id':created['id'],'expected_version':2,'base_plan_version':4})
        assert archived['archived']
        passed.append('archive retains history')
        identity(viewer)
        denied('viewer task creation denied',lambda:task_write('create',{}),'42501')
        def workspace_write(op,body,wid=w):
            return db.execute('select public.tf_workspace_write(%s,%s,%s::jsonb)',(wid,op,json.dumps(body))).fetchone()[0]
        denied('viewer settings denied',lambda:workspace_write('settings',{}),'42501')
        denied('viewer invitation denied',lambda:workspace_write('invite',{}),'42501')
        identity(owner)
        fresh=workspace_write('create',{'name':'Real workspace','display_name':'Owner'},None)
        assert not fresh['is_demo']
        assert db.execute('select public.tf_snapshot(%s)',(fresh['id'],)).fetchone()[0]['tasks']==[]
        passed.append('new workspace starts empty and owned by creator')
        settings={'name':'Renamed workspace','description':'Our work','tracked_branch':'release','review_threshold_hours':48,'base_plan_version':1}
        changed=workspace_write('settings',settings,fresh['id'])
        assert changed['review_threshold_hours']==48 and changed['plan_version']==2
        passed.append('workspace settings persist and version')
        denied('stale settings denied',lambda:workspace_write('settings',settings,fresh['id']),'40001')
        invited=workspace_write('invite',{'email':outsider+'@example.test','role':'member','token_hash':'a'*64},fresh['id'])
        assert 'token_hash' not in invited
        denied('invite token hash cannot be read',lambda:db.execute('select token_hash from public.tf_invites'),'42501')
        identity(viewer)
        denied('invite bound to recipient email',lambda:workspace_write('join',{'token_hash':'a'*64,'display_name':'Wrong'},None),'42501')
        identity(outsider)
        joined=workspace_write('join',{'token_hash':'a'*64,'display_name':'Teammate'},None)
        assert joined['id']==fresh['id']
        assert workspace_write('join',{'token_hash':'a'*64,'display_name':'Teammate'},None)['id']==fresh['id']
        passed.append('recipient joins once using invite')
        denied('member cannot elevate own role',lambda:workspace_write('role',{'user_id':outsider,'role':'manager'},fresh['id']),'42501')
        identity(owner)
        workspace_write('role',{'user_id':outsider,'role':'manager'},fresh['id'])
        passed.append('owner changes teammate role')
        denied('owner cannot be demoted',lambda:workspace_write('role',{'user_id':owner,'role':'viewer'},fresh['id']),'42501')
        invitation=workspace_write('invite',{'email':viewer+'@example.test','role':'viewer','token_hash':'b'*64},fresh['id'])
        workspace_write('revoke_invite',{'invite_id':invitation['id']},fresh['id'])
        identity(viewer)
        denied('revoked invite cannot join',lambda:workspace_write('join',{'token_hash':'b'*64,'display_name':'Viewer'},None),'42501')
        # Stage 4: public GitHub linking is a versioned, audited, role-gated RPC.
        # All effects stay in this disposable transaction and are rolled back below.
        def github_link(workspace, repository, version):
            return db.execute(
                'select public.tf_github_link(%s,%s,%s)',
                (workspace, repository, version)
            ).fetchone()[0]
        identity(viewer)
        denied('viewer GitHub link denied',
               lambda:github_link(w,'example/public-repo',1),'42501')
        identity(member)
        denied('member GitHub link denied',
               lambda:github_link(w,'example/public-repo',1),'42501')
        identity(outsider)
        denied('cross-workspace GitHub link denied',
               lambda:github_link(w,'example/public-repo',1),'42501')
        identity(owner)
        v=db.execute('select plan_version from public.tf_workspaces where id=%s',(w,)).fetchone()[0]
        linked=github_link(w,'example/public-repo',v)
        assert linked['github_repository']=='example/public-repo' and linked['plan_version']==v+1
        assert db.execute("select count(*) from public.tf_audit where workspace_id=%s and kind='workspace.github'",(w,)).fetchone()[0]==1
        passed.append('owner links repository and writes audit entry')
        assert github_link(w,'example/public-repo',v+1)['plan_version']==v+1
        passed.append('same GitHub link is idempotent')
        denied('stale GitHub plan version denied',
               lambda:github_link(w,'example/another-repo',v),'40001')
        denied('invalid GitHub slug denied',
               lambda:github_link(w,'https://evil.example/repo',v+1),'22023')
        assert github_link(w,None,v+1)['github_repository'] is None
        assert db.execute("select count(*) from public.tf_audit where workspace_id=%s and kind='workspace.github'",(w,)).fetchone()[0]==2
        passed.append('owner disconnects repository with audit and version')
        identity(outsider)
        fv=db.execute('select plan_version from public.tf_workspaces where id=%s',(fresh['id'],)).fetchone()[0]
        assert github_link(fresh['id'],'team/public',fv)['plan_version']==fv+1
        passed.append('manager GitHub link allowed for own workspace')
        db.execute('reset role')
        db.execute("select set_config('request.jwt.claim.sub','',true)")
        db.execute('set local role anon')
        denied('anonymous GitHub link denied',
               lambda:github_link(w,'example/public-repo',v+2),'42501')
        db.execute('reset role')
        # Stage 7: use a new non-demo fixture; no hosted data.
        db.execute('reset role')
        ciw, cit = str(uuid4()), str(uuid4())
        db.execute("insert into public.tf_workspaces(id,name,is_demo) values(%s,'CI test',false)",(ciw,))
        db.execute("insert into public.tf_memberships(workspace_id,user_id,role,name,email) values(%s,%s,'owner','CI Owner','ci@example.test')",(ciw,owner))
        db.execute("insert into public.tf_tasks(id,workspace_id,key,title,owner_id) values(%s,%s,'CI-1','CI test',%s)",(cit,ciw,owner))
        def ingest(run, result, stamp, branch='main'):
            return db.execute("select public.tf_ingest_github_ci(%s,%s,'example/repo',9,%s,1,%s,%s,%s::timestamptz)",(ciw,cit,run,branch,result,stamp)).fetchone()[0]
        identity(owner)
        denied('authenticated cannot forge GitHub evidence',lambda:ingest(1,'failure','2026-11-10T10:00:00Z'),'42501')
        db.execute('reset role')
        db.execute('set local role service_role')
        assert ingest(1,'failure','2026-11-10T10:00:00Z')['status']=='recorded'
        assert ingest(1,'failure','2026-11-10T10:00:00Z')['status']=='duplicate'
        assert ingest(2,'success','2026-11-10T11:00:00Z')['status']=='recorded'
        assert ingest(3,'failure','2026-11-10T09:00:00Z')['status']=='recorded'
        assert ingest(4,'failure','2026-11-10T12:00:00Z','other')['status']=='ignored_branch'
        db.execute('reset role')
        assert db.execute("select kind from public.tf_evidence where workspace_id=%s and active",(ciw,)).fetchall()==[('ci_pass',)]
        assert db.execute("select plan_version from public.tf_workspaces where id=%s",(ciw,)).fetchone()[0]==1
        passed.append('signed CI ingestion deduplicates and preserves newest branch evidence without plan change')

        # Phase 5B: real SQL lifecycle, service-only, no hosted data.
        review_delivery=[str(uuid4()) for _ in range(8)]
        def ingest_review(delivery,status,stamp,requested=None,branch='main',pr_state='open',draft=False,reviewer=owner,task_id=cit,workspace=ciw):
            return db.execute("select public.tf_ingest_github_review(%s,%s,%s,'example/repo',7,123,%s,'main',%s,%s,%s::timestamptz,%s::timestamptz,%s,%s)",
                (workspace,task_id,reviewer,delivery,branch,status,requested,stamp,pr_state,draft)).fetchone()[0]
        identity(owner)
        denied('authenticated cannot forge review context',lambda:db.execute('select public.tf_github_review_context(%s,%s,%s)',(ciw,cit,owner)),'42501')
        denied('authenticated cannot forge review evidence',lambda:ingest_review(review_delivery[0],'waiting','2026-11-10T10:00:00Z','2026-11-09T10:00:00Z'),'42501')
        db.execute('reset role')
        db.execute('set local role service_role')
        assert db.execute('select public.tf_github_review_context(%s,%s,%s)',(ciw,cit,owner)).fetchone()[0]=='main'
        denied('foreign reviewer rejected',lambda:ingest_review(review_delivery[0],'waiting','2026-11-10T10:00:00Z','2026-11-09T10:00:00Z',reviewer=outsider),'22023')
        denied('demo review ingest rejected',lambda:ingest_review(review_delivery[0],'waiting','2026-11-10T10:00:00Z','2026-11-09T10:00:00Z',task_id=task,workspace=w),'42501')
        denied('future review request rejected',lambda:ingest_review(review_delivery[0],'waiting','2026-11-10T10:00:00Z','2026-11-11T10:00:00Z'),'22023')
        first=ingest_review(review_delivery[0],'waiting','2026-11-10T10:00:00Z','2026-11-09T10:00:00Z')
        assert first['status']=='recorded'
        assert ingest_review(review_delivery[0],'waiting','2026-11-10T11:00:00Z','2026-11-09T10:00:00Z')['status']=='duplicate'
        refreshed=ingest_review(review_delivery[1],'waiting','2026-11-10T11:00:00Z','2026-11-09T10:00:00Z')
        assert refreshed=={'status':'refreshed','evidence_id':first['evidence_id']}
        resolved=ingest_review(review_delivery[2],'not_requested','2026-11-10T12:00:00Z')
        assert resolved['status']=='recorded'
        assert ingest_review(review_delivery[3],'waiting','2026-11-10T10:30:00Z','2026-11-09T10:00:00Z')['status']=='stale_observation'
        db.execute('reset role')
        assert db.execute("select active from public.tf_evidence where id=%s",(first['evidence_id'],)).fetchone()[0] is False
        assert db.execute("select count(*) from public.tf_evidence where workspace_id=%s and kind='review_delay'",(ciw,)).fetchone()[0]==2
        assert db.execute("select plan_version from public.tf_workspaces where id=%s",(ciw,)).fetchone()[0]==1
        passed.append('review request, refresh, deduplication, resolution and ordering preserve plan')
        db.execute('set local role service_role')
        renewed=ingest_review(review_delivery[4],'waiting','2026-11-10T13:00:00Z','2026-11-10T12:30:00Z')
        assert renewed['status']=='recorded' and renewed['evidence_id']!=first['evidence_id']
        assert ingest_review(review_delivery[5],'unrelated_branch','2026-11-10T14:00:00Z',branch='other')['status']=='recorded'
        db.execute('reset role')
        assert db.execute("select count(*) from public.tf_evidence where workspace_id=%s and kind='review_delay' and active",(ciw,)).fetchone()[0]==0
        passed.append('re-request gets new evidence and changed target branch resolves prior risk')
        # Proposal approval must fail when an active source was replaced after proposal creation.
        db.execute('set local role service_role')
        pending=ingest_review(review_delivery[6],'waiting','2026-11-10T15:00:00Z','2026-11-09T15:00:00Z')
        db.execute('reset role')
        # Keep the fixture evidence recent relative to the CI runner for existing approval freshness checks.
        db.execute("update public.tf_evidence set observed_at=now()-interval '1 minute' where id=%s",(pending['evidence_id'],))
        identity(owner)
        q=db.execute("select public.tf_mutate(%s,'proposal',%s::jsonb,'')",(ciw,json.dumps({'title':'Review recovery','explanation':'Evidence-backed','source':'rules','base_plan_version':1,'actions':[{'task_id':cit,'field':'priority','before':'normal','after':'critical'}],'evidence_ids':[pending['evidence_id']],'risk_id':pending['evidence_id']}))).fetchone()[0]
        db.execute('reset role')
        db.execute('set local role service_role')
        # Use the actual database clock so the newer observation supersedes the current fixture.
        stamp=db.execute("select now()::text").fetchone()[0]
        assert ingest_review(review_delivery[7],'inactive',stamp,pr_state='closed')['status']=='recorded'
        identity(owner)
        denied('resolved review invalidates pending approval',lambda:db.execute("select public.tf_mutate(%s,'decision',%s::jsonb,'review-decision')",(ciw,json.dumps({'proposal_id':q['id'],'decision':'approve','base_plan_version':1}))),'PT409')
        db.execute('reset role')
        assert db.execute("select priority,version from public.tf_tasks where id=%s",(cit,)).fetchone()==('normal',1)
        assert db.execute("select plan_version from public.tf_workspaces where id=%s",(ciw,)).fetchone()[0]==1
        passed.append('resolved review cannot authorize stale proposal or mutate task')

        # TIC prospective learning: no historical timestamp fabrication, no raw personal export.
        lw,lt=str(uuid4()),str(uuid4())
        db.execute("insert into public.tf_workspaces(id,name,is_demo) values(%s,'Learning test',false)",(lw,))
        db.execute("insert into public.tf_memberships(workspace_id,user_id,role,name,email,available_hours,availability_start,availability_end) values(%s,%s,'owner','Learning Owner','owner@example.test',24,now()-interval '1 day',now()+interval '3 days')",(lw,owner))
        db.execute("insert into public.tf_memberships(workspace_id,user_id,role,name,email) values(%s,%s,'member','Learning Member','member@example.test')",(lw,member))
        db.execute("insert into public.tf_tasks(id,workspace_id,key,title,owner_id,estimate_hours,due_at,created_at) values(%s,%s,'L-1','Learning sample',%s,8,now()+interval '2 days',now()-interval '1 hour')",(lt,lw,owner))
        def learning(op, task_id=None, enable=None, workspace=lw):
            return db.execute("select public.tf_learning(%s,%s,%s,%s)",(workspace,op,task_id,enable)).fetchone()[0]
        identity(owner)
        assert not learning('status')['enabled']
        denied('learning capture without consent denied',lambda:learning('capture',lt),'42501')
        identity(member)
        denied('member cannot enable learning',lambda:learning('consent',enable=True),'42501')
        denied('member cannot export learning samples',lambda:learning('export'),'42501')
        identity(outsider)
        denied('outsider learning status denied',lambda:learning('status'),'42501')
        identity(owner)
        assert learning('consent',enable=True)['enabled']
        assert learning('capture',lt)['status']=='missing_evidence'
        db.execute('reset role')
        db.execute('set local role service_role')
        db.execute("select public.tf_ingest_github_ci(%s,%s,'example/learning',5,10,1,'main','failure',now()-interval '1 minute')",(lw,lt))
        db.execute("select public.tf_ingest_github_review(%s,%s,%s,'example/learning',8,123,%s,'main','main','waiting',now()-interval '30 hours',now()-interval '1 minute','open',false)",(lw,lt,owner,str(uuid4())))
        identity(owner)
        assert learning('capture',lt)['status']=='captured'
        assert learning('capture',lt)['status']=='already_captured'
        assert learning('status')['samples']==1 and learning('status')['labeled']==0
        assert learning('export')['rows']==[]
        assert db.execute("select plan_version from public.tf_workspaces where id=%s",(lw,)).fetchone()[0]==1
        db.execute("select public.tf_mutate(%s,'status',%s::jsonb,'')",(lw,json.dumps({'task_id':lt,'status':'done','expected_version':1})))
        rows=learning('export')['rows']
        assert len(rows)==1 and rows[0]['completed_at'] is not None
        assert len(rows[0]['features'])==12 and rows[0]['features']['ci_failures']==1
        assert 'task_id' not in rows[0] and 'name' not in rows[0]
        db.execute('reset role')
        db.execute("update public.tf_tasks set due_at=due_at+interval '1 day' where id=%s",(lt,))
        identity(owner)
        assert learning('export')['rows']==[]
        assert learning('consent',enable=False)['samples']==0
        denied('export after revocation denied',lambda:learning('export'),'42501')
        db.execute('reset role')
        assert db.execute("select count(*) from teamflow_private.tf_learning_samples where workspace_id=%s",(lw,)).fetchone()[0]==0
        passed.append('learning opt-in, role boundaries, authoritative snapshots, outcome labeling, revision exclusion and purge')

        # Recovery capacity is checked at approval time, even if the plan version did not change.
        rw,rt=str(uuid4()),str(uuid4())
        db.execute("insert into public.tf_workspaces(id,name,is_demo) values(%s,'Recovery capacity test',false)",(rw,))
        db.execute("insert into public.tf_memberships(workspace_id,user_id,role,name,email) values(%s,%s,'owner','Owner','owner@example.test')",(rw,owner))
        db.execute("insert into public.tf_memberships(workspace_id,user_id,role,name,email,available_hours,availability_start,availability_end) values(%s,%s,'member','Member','member@example.test',12,now()-interval '2 days',now()-interval '1 day')",(rw,member))
        db.execute("insert into public.tf_tasks(id,workspace_id,key,title,owner_id) values(%s,%s,'R-1','Review test',%s)",(rt,rw,owner))
        identity(owner)
        q=db.execute("select public.tf_mutate(%s,'proposal',%s::jsonb,'')",(rw,json.dumps({'title':'Review coverage','explanation':'Fixture','source':'rules','base_plan_version':1,'actions':[{'task_id':rt,'field':'reviewer_id','before':None,'after':member}]}))).fetchone()[0]
        decision={'proposal_id':q['id'],'decision':'approve','base_plan_version':1}
        denied('expired recovery capacity blocks approval',lambda:db.execute("select public.tf_mutate(%s,'decision',%s::jsonb,'expired-review')",(rw,json.dumps(decision))),'PT409')
        assert db.execute("select reviewer_id from public.tf_tasks where id=%s",(rt,)).fetchone()[0] is None
        assert db.execute("select plan_version from public.tf_workspaces where id=%s",(rw,)).fetchone()[0]==1
        db.execute('reset role')
        db.execute("update public.tf_memberships set availability_start=now()-interval '1 day',availability_end=now()+interval '1 day' where workspace_id=%s and user_id=%s",(rw,member))
        identity(owner)
        assert db.execute("select public.tf_mutate(%s,'decision',%s::jsonb,'valid-review')",(rw,json.dumps(decision))).fetchone()[0]['status']=='approved'
        assert str(db.execute("select reviewer_id from public.tf_tasks where id=%s",(rt,)).fetchone()[0])==member
        db.execute('reset role')
        passed.append('dated recovery approval guard rolls back expired assignments and accepts current capacity')
        prepare_sync = runpy.run_path(str(ROOT/'scripts/prepare-github-sync.py'))['prepare']
        def sync(runs):
            sql, _ = prepare_sync(w,'T-1','example/repo',"Build ' $sync$",runs)
            # Keep the existing test transaction; no commit from operator SQL is allowed here.
            assert sql.startswith('begin;\n') and sql.endswith('commit;\n')
            db.execute(sql[len('begin;\n'):-len('commit;\n')])
        run={'id':101,'run_attempt':1,'name':"Build ' $sync$",'status':'completed','conclusion':'failure','updated_at':'2026-11-10T01:00:00Z','head_branch':'main'}
        sync([run]);sync([run])
        assert db.execute("select count(*) from public.tf_evidence where workspace_id=%s and origin='github'",(w,)).fetchone()[0]==1
        passed.append('GitHub import deduplicates run attempts and safely quotes source text')
        sync([{**run,'id':102,'conclusion':'success','updated_at':'2026-11-10T02:00:00Z'}])
        sync([{**run,'id':99,'updated_at':'2026-11-09T02:00:00Z'}])
        assert db.execute("select kind from public.tf_evidence where workspace_id=%s and origin='github' and active",(w,)).fetchone()[0]=='ci_pass'
        passed.append('older GitHub failures cannot reactivate after a newer passing check')
        sync([{**run,'id':103,'head_branch':'feature','updated_at':'2026-11-10T03:00:00Z'}])
        assert db.execute("select count(*) from public.tf_evidence where workspace_id=%s and origin='github' and active",(w,)).fetchone()[0]==2
        passed.append('GitHub branches retain independent current evidence')
    finally:
        db.rollback()
print(f'{len(passed)} SQL checks passed; all test changes rolled back.')
for item in passed: print('PASS '+item)
