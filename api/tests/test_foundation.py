import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func, inspect
from sqlalchemy.orm import Session
from app.db import get_db
from app.main import app
from app.models import User, Project, Membership, Task, Session as LoginSession, LoginAttempt
from app.seed import seed, uid, PROJECT_ID
from app.security import digest, COOKIE

ORIGIN={'origin':'http://localhost:3000'}

@pytest.fixture(scope='module')
def engine():
    url=os.environ['TEST_DATABASE_URL']
    assert url.rsplit('/',1)[-1] in ('teamflow_test','teamflow_test_utf8'), 'Tests require the dedicated local test database'
    previous=os.environ['MIGRATION_DATABASE_URL']
    os.environ['MIGRATION_DATABASE_URL']=url
    cfg=Config('alembic.ini')
    command.upgrade(cfg,'head')
    eng=create_engine(url)
    # Only the disposable test database is downgraded.
    command.downgrade(cfg,'base')
    assert 'tasks' not in inspect(eng).get_table_names()
    command.upgrade(cfg,'head')
    with Session(eng) as db: seed(db)
    os.environ['MIGRATION_DATABASE_URL']=previous
    yield eng
    eng.dispose()

@pytest.fixture()
def client(engine):
    def override():
        with Session(engine) as db: yield db
    app.dependency_overrides[get_db]=override
    with TestClient(app) as c: yield c
    app.dependency_overrides.clear()

def login(client,email='asha@demoworks.test'):
    result=client.post('/api/auth/login',json={'email':email,'password':os.environ['DEMO_PASSWORD']},headers=ORIGIN)
    assert result.status_code==200,result.text
    return result

def test_health_migration_and_seed_idempotence(client,engine):
    assert client.get('/health/live').status_code==200
    assert client.get('/health/ready').status_code==200
    with Session(engine) as db:
        seed(db);seed(db)
        assert db.scalar(select(func.count()).select_from(Task))==7
        assert db.scalar(select(func.count()).select_from(Membership))==5

def test_auth_and_cookie_policy(client):
    assert client.get('/api/projects').status_code==401
    r=login(client)
    assert 'password' not in r.text
    assert 'HttpOnly' in r.headers['set-cookie']
    assert 'SameSite=strict' in r.headers['set-cookie']
    assert client.get('/api/me').json()['name']=='Asha'

def test_wrong_password_and_origin(client):
    assert client.post('/api/auth/login',json={'email':'asha@demoworks.test','password':'wrong'},headers=ORIGIN).status_code==401
    assert client.post('/api/auth/login',json={'email':'asha@demoworks.test','password':os.environ['DEMO_PASSWORD']},headers={'origin':'https://attacker.example'}).status_code==403
    assert client.post('/api/auth/login',json={'email':'asha@demoworks.test','password':'wrong'}).status_code==403

def test_dashboard_refresh_and_counts(client):
    login(client)
    path=f'/api/projects/{PROJECT_ID}/dashboard'
    first=client.get(path).json();second=client.get(path).json()
    assert first['tasks']==second['tasks']
    assert first['counts']=={'total':7,'todo':4,'in_progress':2,'blocked':0,'done':1}
    assert len(first['members'])==5 and first['plan_version']==1
    assert first['is_demo'] is True
    assert 'risks' not in first['counts']

def test_cross_project_access_even_with_forged_role(client,engine):
    other=uuid4()
    with Session(engine) as db:
        db.add(Project(id=other,organization_id=uid('demoworks'),name='Private project',description='Not a member',fixture_label='Test',is_demo=True));db.commit()
    login(client)
    assert all(p['id']!=str(other) for p in client.get('/api/projects').json())
    for suffix in ['dashboard','tasks','settings']:
        assert client.get(f'/api/projects/{other}/{suffix}',headers={'X-Role':'lead'}).status_code==404

def test_roles_are_read_from_database(client,engine):
    login(client,'nila@demoworks.test')
    path=f'/api/projects/{PROJECT_ID}/settings'
    assert client.get(path,headers={'X-Role':'lead'}).status_code==403
    with Session(engine) as db:
        membership=db.get(Membership,(PROJECT_ID,uid('Nila')))
        membership.role='lead';db.commit()
    try:
        assert client.get(path).status_code==200
    finally:
        with Session(engine) as db:
            db.get(Membership,(PROJECT_ID,uid('Nila'))).role='contributor';db.commit()

def test_session_revocation_and_expiry(client,engine):
    login(client)
    token=client.cookies.get(COOKIE)
    assert client.post('/api/auth/logout',headers=ORIGIN).status_code==200
    client.cookies.set(COOKIE,token)
    assert client.get('/api/me').status_code==401
    client.cookies.clear();login(client)
    token=client.cookies.get(COOKIE)
    with Session(engine) as db:
        db.get(LoginSession,digest(token)).expires_at=datetime.now(timezone.utc)-timedelta(seconds=1);db.commit()
    assert client.get('/api/me').status_code==401

def test_login_rate_limit(client):
    payload={'email':'missing@example.test','password':'wrong'}
    for _ in range(10):
        assert client.post('/api/auth/login',json=payload,headers=ORIGIN).status_code==401
    assert client.post('/api/auth/login',json=payload,headers=ORIGIN).status_code==429

def test_status_update_requires_expected_version(client):
    login(client)
    assert client.patch(f'/api/tasks/{uid("LOGIN-102")}',json={'status':'done'},headers=ORIGIN).status_code==422

def test_runtime_database_role_cannot_modify_plan():
    from app.db import engine as runtime
    from sqlalchemy import text
    with runtime.connect() as connection:
        assert connection.scalar(text("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")) is False
        assert connection.scalar(text("SELECT has_table_privilege(current_user, 'tasks', 'UPDATE')")) is False
