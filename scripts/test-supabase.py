"""Run the production SQL against ONLY the disposable local test database.

Auth.uid() is shimmed from a JWT subject, never presented as hosted Auth proof.
Every change, including schema/role scaffolding, rolls back at the end.
"""
import json
import os
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
        db.execute("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$")
        db.execute("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$")
        db.execute('GRANT USAGE ON SCHEMA public,auth TO authenticated,anon')
        db.execute('GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon')
        for file in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            db.execute(file.read_text(encoding='utf-8'))
        passed.append('migration applies')
        w, other, owner, member, viewer, outsider, task, successor = [str(uuid4()) for _ in range(8)]
        for who in (owner,member,viewer,outsider): db.execute('insert into auth.users values(%s)',(who,))
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
        denied('key reuse rejected',lambda:rpc('decision',{**decision,'decision':'reject'},'approve-key'),'40001')
        denied('second approval rejected',lambda:rpc('decision',decision,'another-key'),'40001')
        denied('missing version rejected',lambda:rpc('status',{'task_id':task,'status':'blocked'}),'40001')
        denied('stale proposal rejected',lambda:rpc('proposal',proposal),'40001')
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
    finally:
        db.rollback()
print(f'{len(passed)} SQL checks passed; all test changes rolled back.')
for item in passed: print('PASS '+item)
