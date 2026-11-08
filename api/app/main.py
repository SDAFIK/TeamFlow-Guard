import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy import select, text, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session as DBSession
from .db import get_db
from .models import User, Project, Membership, Task, PlanVersion, Session, LoginAttempt
from .schemas import LoginInput, Person, ProjectSummary, Overview, TaskView, Member, Message
from .security import passwords, DUMMY_HASH, COOKIE, digest, require_origin, current_user, membership
from .deployment import validate_hosted_environment, mount_frontend

validate_hosted_environment(os.environ)
app = FastAPI(title='TeamFlow Guard', version='0.1.0')
from .workflow import router as workflow_router
app.include_router(workflow_router)
from .github import router as github_router
app.include_router(github_router)

@app.middleware('http')
async def response_headers(request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'same-origin'
    if os.getenv('APP_ENV') == 'production':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response

def error(status, message, code):
    return JSONResponse(status_code=status, content={'code': code, 'message': message, 'request_id': str(uuid4())})

@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return error(exc.status_code, str(exc.detail), f'HTTP_{exc.status_code}')

@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return error(422, 'Invalid request fields', 'VALIDATION_ERROR')

@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    return error(503, 'Database unavailable. Please retry.', 'DATABASE_UNAVAILABLE')

@app.get('/health/live', response_model=Message)
def live():
    return {'message': 'alive'}

@app.get('/health/ready', response_model=Message)
def ready(db: DBSession = Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'message': 'ready'}

@app.post('/api/auth/login', response_model=Person, dependencies=[Depends(require_origin)])
def login(data: LoginInput, response: Response, db: DBSession = Depends(get_db)):
    email = data.email.strip().lower()
    now = datetime.now(timezone.utc)
    # Serialize attempts per account so concurrent requests cannot bypass the limit.
    key = digest(email)
    db.execute(insert(LoginAttempt).values(key=key, count=0, window_start=now).on_conflict_do_nothing())
    attempt = db.scalar(select(LoginAttempt).where(LoginAttempt.key == key).with_for_update())
    if now - attempt.window_start > timedelta(minutes=15):
        attempt.count, attempt.window_start = 0, now
    if attempt.count >= 10:
        db.rollback()
        raise HTTPException(429, 'Too many attempts. Try again in 15 minutes.')
    user = db.scalar(select(User).where(User.email == email))
    valid = passwords.verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        attempt.count += 1
        db.commit()
        raise HTTPException(401, 'Email or password is incorrect')
    attempt.count = 0
    token = secrets.token_urlsafe(32)
    db.add(Session(token_hash=digest(token), user_id=user.id, expires_at=now+timedelta(hours=8)))
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, samesite='strict', secure=os.getenv('COOKIE_SECURE') == 'true', max_age=28800, path='/')
    return user

@app.post('/api/auth/logout', response_model=Message, dependencies=[Depends(require_origin)])
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    session = db.get(Session, digest(token)) if token else None
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie(COOKIE, path='/')
    return {'message': 'Signed out'}

@app.get('/api/me', response_model=Person)
def me(user=Depends(current_user)):
    return user

@app.get('/api/projects', response_model=list[ProjectSummary])
def projects(user=Depends(current_user), db: DBSession = Depends(get_db)):
    return [ProjectSummary(id=p.id, name=p.name, role=m.role) for p,m in db.execute(select(Project, Membership).join(Membership).where(Membership.user_id==user.id).order_by(Project.name))]

@app.get('/api/projects/{project_id}/dashboard', response_model=Overview)
def dashboard(project_id: UUID, user=Depends(current_user), db: DBSession = Depends(get_db)):
    member = membership(db, project_id, user)
    project = db.get(Project, project_id)
    tasks = list(db.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.position)))
    people = [Member(id=u.id, name=u.name, email=u.email, role=m.role, specialty=m.specialty, available_hours=m.available_hours) for u,m in db.execute(select(User,Membership).join(Membership).where(Membership.project_id==project_id).order_by(User.name))]
    version = db.scalar(select(func.max(PlanVersion.number)).where(PlanVersion.project_id == project_id))
    return Overview(project=ProjectSummary(id=project.id,name=project.name,role=member.role), description=project.description, is_demo=project.is_demo, fixture_label=project.fixture_label, plan_version=version, as_of=datetime.now(timezone.utc), tasks=[TaskView.model_validate(t) for t in tasks], members=people, counts={'total':len(tasks), **{s:sum(t.status==s for t in tasks) for s in ['todo','in_progress','blocked','done']}})

@app.get('/api/projects/{project_id}/tasks', response_model=list[TaskView])
def tasks(project_id: UUID, user=Depends(current_user), db: DBSession = Depends(get_db)):
    membership(db, project_id, user)
    return list(db.scalars(select(Task).where(Task.project_id==project_id).order_by(Task.position)))

@app.get('/api/projects/{project_id}/settings', response_model=ProjectSummary)
def settings(project_id: UUID, user=Depends(current_user), db: DBSession = Depends(get_db)):
    member = membership(db, project_id, user)
    if member.role != 'lead':
        raise HTTPException(403, 'Only project leads may view project settings')
    project = db.get(Project, project_id)
    return ProjectSummary(id=project.id, name=project.name, role=member.role)

mount_frontend(app, os.getenv('WEB_DIST'))
