import os
from uuid import uuid5, NAMESPACE_URL
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from .db import database_url
from .models import User, Organization, Project, Membership, PlanVersion, Task, TaskDependency
from .security import passwords

def uid(name):
    return uuid5(NAMESPACE_URL, 'teamflow-demo/' + name)

PROJECT_ID = uid('retailflow')

def seed(db):
    password = os.environ.get('DEMO_PASSWORD')
    if not password or len(password) < 12:
        raise RuntimeError('Set DEMO_PASSWORD to at least 12 characters')
    org_id = uid('demoworks')
    if not db.get(Organization, org_id):
        db.add(Organization(id=org_id, name='DemoWorks')); db.flush()
    if not db.get(Project, PROJECT_ID):
        db.add(Project(id=PROJECT_ID, organization_id=org_id, name='RetailFlow Checkout', description='A shared plan for a smoother checkout release.', is_demo=True, fixture_label='Sample sprint · simulated Friday release')); db.flush()
    for name, role, specialty in [('Asha','lead','Product & delivery'),('Rahim','contributor','Backend engineering'),('Nila','contributor','Auth & frontend'),('Arif','contributor','Checkout experience'),('Sami','reviewer','Quality assurance')]:
        user_id = uid(name)
        if not db.get(User,user_id):
            db.add(User(id=user_id,email=f'{name.lower()}@demoworks.test',name=name,password_hash=passwords.hash(password))); db.flush()
        if not db.get(Membership,(PROJECT_ID,user_id)):
            db.add(Membership(project_id=PROJECT_ID,user_id=user_id,role=role,specialty=specialty))
    db.flush()
    if not db.get(PlanVersion,(PROJECT_ID,1)):
        db.add(PlanVersion(project_id=PROJECT_ID,number=1)); db.flush()
    rows = [('AUTH-101','Authentication service','Rahim','done','Session and identity foundation.'),('LOGIN-102','Login UI','Nila','in_progress','Accessible sign-in and validation states.'),('CHECK-103','Checkout UI','Arif','todo','Checkout flow connected to authenticated customers.'),('PAY-104','Payment tests','Sami','todo','Verify the payment handoff and error states.'),('QA-105','QA pass','Sami','todo','Review the integrated checkout experience.'),('REL-106','Release','Asha','todo','Coordinate the release checklist.'),('CAT-107','Catalog UI','Nila','in_progress','Independent catalog work can continue.')]
    for i,(key,title,owner,status,description) in enumerate(rows):
        if not db.get(Task,uid(key)):
            db.add(Task(id=uid(key),project_id=PROJECT_ID,key=key,title=title,description=description,status=status,owner_id=uid(owner),position=i,plan_version=1))
    db.flush()
    for before,after in [('AUTH-101','LOGIN-102'),('LOGIN-102','CHECK-103'),('CHECK-103','PAY-104'),('PAY-104','QA-105'),('QA-105','REL-106')]:
        if not db.get(TaskDependency,(uid(before),uid(after))):
            db.add(TaskDependency(project_id=PROJECT_ID,predecessor_id=uid(before),successor_id=uid(after)))
    db.commit()

if __name__ == '__main__':
    engine=create_engine(os.getenv('MIGRATION_DATABASE_URL') or database_url())
    with Session(engine) as db:
        seed(db)
    print('RetailFlow fixture ready; existing records preserved.')
