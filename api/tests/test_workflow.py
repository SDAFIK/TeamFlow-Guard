from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4
import pytest
from sqlalchemy import text,select,func
from sqlalchemy.orm import Session
from app.models import Task,Membership,AuditEvent,RecoveryProposal,AnalysisRun
from app.seed import seed,uid,PROJECT_ID
from app.graph import validate_dag,reachable
from app.risks import classify
from app import ai
from test_foundation import engine,client,login,ORIGIN

@pytest.fixture()
def flow(client,engine):
    assert engine.url.database in ('teamflow_test','teamflow_test_utf8')
    with engine.begin() as conn: conn.execute(text('TRUNCATE organizations, users, login_attempts CASCADE'))
    with Session(engine) as db: seed(db)
    login(client)
    return client

def overview(c): return c.get(f'/api/projects/{PROJECT_ID}/dashboard').json()
def replay(c,kind='ci_failure',task='LOGIN-102'):
    r=c.post(f'/api/projects/{PROJECT_ID}/demo-events',json={'kind':kind,'task_id':str(uid(task)),'event_key':str(uuid4())},headers=ORIGIN)
    assert r.status_code==200,r.text
    return next((x for x in r.json() if x['active'] and x['evidence']['kind']==kind),None)
def proposal(c):
    risk=replay(c)
    r=c.post(f'/api/risks/{risk["id"]}/analyze?mode=rules',headers=ORIGIN)
    assert r.status_code==200,r.text
    return r.json()
def decide(c,p,decision='approve',key=None):
    return c.post(f'/api/proposals/{p["id"]}/decision',json={'decision':decision,'base_plan_version':p['base_plan_version']},headers={**ORIGIN,'Idempotency-Key':key or str(uuid4())})

def test_graph_and_status_history(flow):
    data=flow.get(f'/api/projects/{PROJECT_ID}/dependencies?selected={uid("LOGIN-102")}').json()
    assert str(uid('CHECK-103')) in data['downstream_ids']
    assert str(uid('REL-106')) in data['downstream_ids']
    assert str(uid('CAT-107')) not in data['downstream_ids']
    result=flow.patch(f'/api/tasks/{uid("LOGIN-102")}',json={'status':'blocked','expected_version':1,'note':'Waiting on a fix'},headers=ORIGIN)
    assert result.status_code==200,result.text
    assert result.json()['version']==2
    assert flow.patch(f'/api/tasks/{uid("LOGIN-102")}',json={'status':'todo','expected_version':1},headers=ORIGIN).status_code==409
    risks=flow.get(f'/api/projects/{PROJECT_ID}/risks').json()
    assert risks[0]['evidence']['kind']=='dependency'
    assert flow.get(f'/api/projects/{PROJECT_ID}/audit').json()[0]['kind']=='task.status'

def test_cycle_cross_project_and_completed_task_denied(flow):
    for before,after in [(uid('REL-106'),uid('LOGIN-102')),(uuid4(),uid('LOGIN-102')),(uid('LOGIN-102'),uid('LOGIN-102'))]:
        assert flow.post(f'/api/projects/{PROJECT_ID}/dependencies/validate',json={'predecessor_id':str(before),'successor_id':str(after)},headers=ORIGIN).status_code==422
    assert flow.patch(f'/api/tasks/{uid("AUTH-101")}',json={'status':'todo','expected_version':1},headers=ORIGIN).status_code==422

def test_replay_idempotence_and_source_isolation(flow):
    payload={'kind':'ci_failure','task_id':str(uid('LOGIN-102')),'event_key':'fixed-delivery-id'}
    a=flow.post(f'/api/projects/{PROJECT_ID}/demo-events',json=payload,headers=ORIGIN)
    b=flow.post(f'/api/projects/{PROJECT_ID}/demo-events',json=payload,headers=ORIGIN)
    assert a.json()==b.json()
    assert a.json()[0]['evidence']['origin']=='replay'
    payload['kind']='capacity'
    assert flow.post(f'/api/projects/{PROJECT_ID}/demo-events',json=payload,headers=ORIGIN).status_code==409
    replay(flow)
    assert len([r for r in flow.get(f'/api/projects/{PROJECT_ID}/risks').json() if r['active']])==1

def test_approve_refresh_and_idempotency(flow):
    before=overview(flow);p=proposal(flow);key=str(uuid4())
    a=decide(flow,p,key=key);b=decide(flow,p,key=key)
    assert a.status_code==b.status_code==200,a.text
    assert a.json()==b.json()
    after=overview(flow)
    assert after['plan_version']==before['plan_version']+1
    task=next(t for t in after['tasks'] if t['key']=='LOGIN-102')
    assert task['priority']=='critical' and task['reviewer_id']
    assert overview(flow)['tasks']==after['tasks']
    assert len([e for e in flow.get(f'/api/projects/{PROJECT_ID}/audit').json() if e['kind']=='proposal.approved'])==1
    assert decide(flow,p,decision='reject',key=key).status_code==409
    # Approval is not a fabricated passing CI check.
    assert any(r['active'] for r in flow.get(f'/api/projects/{PROJECT_ID}/risks').json())

def test_reject_stale_and_contributor(flow):
    p=proposal(flow);before=overview(flow)
    login(flow,'nila@demoworks.test')
    assert decide(flow,p).status_code==403
    login(flow)
    assert decide(flow,p,'reject').status_code==200
    assert overview(flow)['tasks']==before['tasks']
    assert overview(flow)['plan_version']==before['plan_version']
    p=proposal(flow)
    assert flow.patch(f'/api/tasks/{uid("CAT-107")}',json={'status':'todo','expected_version':1},headers=ORIGIN).status_code==200
    assert decide(flow,p).status_code==409

def test_zero_capacity_revalidated_at_approval(flow,engine):
    p=proposal(flow)
    assigned=next(a['after'] for a in p['actions'] if a['field']=='reviewer_id')
    with Session(engine) as db:
        from uuid import UUID
        db.get(Membership,(PROJECT_ID,UUID(assigned))).available_hours=0;db.commit()
    before=overview(flow)
    assert decide(flow,p).status_code==422
    assert overview(flow)['tasks']==before['tasks']
    assert overview(flow)['plan_version']==before['plan_version']

def test_capacity_and_review_are_distinct_risk_families(flow):
    capacity=replay(flow,'capacity');review=replay(flow,'review_delay')
    assert capacity['severity']=='high'
    assert '0 hours' in capacity['reason']
    assert review['severity']=='medium'
    assert capacity['evidence']['id']!=review['evidence']['id']

def test_concurrent_approval_applies_once(flow):
    p=proposal(flow)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda _:decide(flow,p),range(2)))
    assert sorted(r.status_code for r in responses)==[200,409]
    assert overview(flow)['plan_version']==p['base_plan_version']+1

def test_model_timeout_leaves_board_and_audits_usable(flow,monkeypatch,engine):
    risk=replay(flow)
    monkeypatch.setenv('OPENAI_API_KEY','test-key');monkeypatch.setenv('OPENAI_MODEL','test-model')
    def fail(context): raise ai.ProviderFailure('OpenAI timed out')
    monkeypatch.setattr(ai,'analyze',fail)
    before=overview(flow)
    r=flow.post(f'/api/risks/{risk["id"]}/analyze',headers=ORIGIN)
    assert r.status_code==503
    assert overview(flow)['tasks']==before['tasks']
    with Session(engine) as db:
        assert db.scalar(select(AnalysisRun.status))=='failed'
        assert db.scalar(select(func.count()).select_from(RecoveryProposal))==0

def test_dependency_proposal_is_reviewed_and_applied(flow):
    r=flow.post(f'/api/projects/{PROJECT_ID}/proposals',headers=ORIGIN,json={'title':'Connect catalog to checkout','base_plan_version':1,'actions':[{'task_id':str(uid('CHECK-103')),'field':'dependency','before':None,'after':str(uid('CAT-107'))}]})
    assert r.status_code==200,r.text
    assert decide(flow,r.json()).status_code==200
    graph=flow.get(f'/api/projects/{PROJECT_ID}/dependencies?selected={uid("CAT-107")}').json()
    assert str(uid('REL-106')) in graph['downstream_ids']

def test_combined_reviewer_capacity(flow,engine):
    with Session(engine) as db:
        db.get(Membership,(PROJECT_ID,uid('Sami'))).available_hours=2;db.commit()
    actions=[{'task_id':str(uid(key)),'field':'reviewer_id','before':None,'after':str(uid('Sami'))} for key in ('LOGIN-102','CHECK-103')]
    r=flow.post(f'/api/projects/{PROJECT_ID}/proposals',headers=ORIGIN,json={'title':'Two reviews exceed capacity','base_plan_version':1,'actions':actions})
    assert r.status_code==422
    assert overview(flow)['plan_version']==1

def test_availability_replaces_old_signals(flow):
    login(flow,'nila@demoworks.test')
    for hours in (0,1):
        assert flow.put(f'/api/projects/{PROJECT_ID}/availability',headers=ORIGIN,json={'hours':hours}).status_code==200
    active=[r for r in flow.get(f'/api/projects/{PROJECT_ID}/risks').json() if r['active']]
    assert len(active)==2

def test_signed_github_delivery_and_source_isolation(flow,monkeypatch):
    import json,hmac,hashlib
    monkeypatch.setenv('GITHUB_WEBHOOK_SECRET','test-secret')
    monkeypatch.setenv('GITHUB_REPOSITORY','test/repo')
    monkeypatch.setenv('GITHUB_PROJECT_ID',str(PROJECT_ID))
    monkeypatch.setenv('GITHUB_WORKFLOW_TASKS',json.dumps({'Login checks':'LOGIN-102'}))
    payload={'action':'completed','repository':{'full_name':'test/repo'},'workflow_run':{'name':'Login checks','id':100,'run_attempt':1,'status':'completed','conclusion':'failure','head_branch':'main','updated_at':'2026-11-08T10:00:00Z'}}
    def deliver(data,signature=True,delivery=None):
        body=json.dumps(data).encode()
        sig='sha256='+hmac.new(b'test-secret',body,hashlib.sha256).hexdigest() if signature else 'invalid'
        return flow.post('/api/webhooks/github',content=body,headers={'x-github-event':'workflow_run','x-github-delivery':delivery or str(uuid4()),'x-hub-signature-256':sig})
    assert deliver(payload,False).status_code==403
    delivery=str(uuid4())
    assert deliver(payload,delivery=delivery).status_code==200
    assert 'already' in deliver(payload,delivery=delivery).json()['message']
    replay(flow,'ci_pass')
    assert any(r['active'] and r['evidence']['origin']=='github' for r in flow.get(f'/api/projects/{PROJECT_ID}/risks').json())
    payload['workflow_run'].update(id=101,conclusion='success',updated_at='2026-11-08T11:00:00Z')
    assert deliver(payload,delivery=delivery).status_code==409
    assert deliver(payload).status_code==200
    payload['workflow_run'].update(id=99,conclusion='failure',updated_at='2026-11-08T09:00:00Z')
    assert deliver(payload).status_code==200
    assert not any(r['active'] for r in flow.get(f'/api/projects/{PROJECT_ID}/risks').json())
    payload['repository']['full_name']='other/repo'
    assert deliver(payload).status_code==422

@pytest.mark.parametrize('kind,status,count,payload,hours,expected',[
    ('ci_failure','in_progress',4,{},40,'high'),('ci_failure','todo',0,{},40,'medium'),('ci_failure','done',4,{},40,None),
    ('dependency','blocked',2,{},40,'high'),('dependency','blocked',0,{},40,'medium'),('dependency','todo',4,{},40,None),
    ('review_delay','todo',3,{'waiting_hours':48},40,'medium'),('review_delay','todo',3,{'waiting_hours':24},40,None),('review_delay','todo',3,{},40,None),
    ('capacity','in_progress',2,{},0,'high'),('capacity','todo',2,{},4,'medium'),('capacity','todo',2,{},40,None),
    ('capacity','done',2,{},0,None),('review_delay','done',3,{'waiting_hours':48},40,None),('unknown','blocked',5,{},0,None),
])
def test_risk_evaluation_cases(kind,status,count,payload,hours,expected):
    result=classify(kind,SimpleNamespace(key='T-1',status=status,estimate_hours=8),count,payload,hours)
    assert (result[0] if result else None)==expected

@pytest.mark.parametrize('length',range(2,17))
def test_graph_evaluation_cases(length):
    nodes=list(range(length));edges=[(i,i+1) for i in range(length-1)]
    validate_dag(nodes,edges)
    assert set(reachable(nodes,edges,0))=={str(i) for i in range(1,length)}
    with pytest.raises(ValueError): validate_dag(nodes,edges+[(length-1,0)])
