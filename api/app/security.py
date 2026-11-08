import hashlib
import os
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy.orm import Session as DBSession
from .db import get_db
from .models import Session, User, Membership

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash('constant-time-missing-account-check')
COOKIE = 'teamflow_session'

def digest(token: str):
    return hashlib.sha256(token.encode()).hexdigest()

def require_origin(request: Request):
    expected = os.getenv('WEB_ORIGIN', 'http://localhost:3000')
    if request.headers.get('origin') != expected:
        raise HTTPException(403, 'Request origin is not allowed')

def current_user(request: Request, db: DBSession = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    session = db.get(Session, digest(token)) if token else None
    if not session or session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(401, 'Sign in to continue')
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, 'Sign in to continue')
    return user

def membership(db, project_id, user):
    member = db.get(Membership, (project_id, user.id))
    if not member:
        raise HTTPException(404, 'Project is unavailable')
    return member
