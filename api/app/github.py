"""Read-only GitHub workflow evidence. No GitHub write credentials are used."""
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from .db import get_db
from .models import Evidence, Task
from .plan import lock_project
from .risks import refresh_findings

router = APIRouter(prefix='/api')

def configuration():
    try:
        mapping = json.loads(os.getenv('GITHUB_WORKFLOW_TASKS', '{}'))
        project_id = UUID(os.environ['GITHUB_PROJECT_ID'])
        repo = os.environ['GITHUB_REPOSITORY']
        if not isinstance(mapping, dict) or not mapping or '/' not in repo or not all(isinstance(k,str) and isinstance(v,str) for k,v in mapping.items()): return None
        return project_id, repo, mapping
    except (ValueError, KeyError):
        return None

def ingest(db, payload, source='github', delivery_id=None):
    config = configuration()
    if not config: raise HTTPException(503, 'GitHub repository mapping is not configured')
    project_id, repo, mapping = config
    repository=payload.get('repository')
    if not isinstance(repository,dict) or not isinstance(repository.get('full_name'),str):
        raise HTTPException(422, 'Repository identity is required')
    if repository['full_name'].casefold() != repo.casefold():
        raise HTTPException(422, 'Repository is not mapped to this workspace')
    run = payload.get('workflow_run', {})
    if not isinstance(run,dict): raise HTTPException(422, 'Workflow run is invalid')
    if payload.get('action') != 'completed' or run.get('status') != 'completed':
        return {'message': 'Ignored incomplete workflow run'}
    if not isinstance(run.get('name'),str): raise HTTPException(422, 'Workflow name is required')
    task_key = mapping.get(run.get('name'))
    if not task_key: raise HTTPException(422, 'Workflow has no explicit task mapping')
    conclusion = run.get('conclusion')
    if conclusion not in ('failure', 'timed_out', 'success'):
        return {'message': 'Ignored non-actionable conclusion'}
    try:
        run_id, attempt = int(run['id']), int(run.get('run_attempt', 1))
        observed = datetime.fromisoformat(run['updated_at'].replace('Z', '+00:00'))
        if observed.tzinfo is None or run_id < 1 or attempt < 1: raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(422, 'Workflow run identity or timestamp is invalid')
    branch = run.get('head_branch')
    if not isinstance(branch, str) or not branch: raise HTTPException(422, 'Workflow branch is required')
    lock_project(db, project_id)
    if delivery_id:
        delivered = db.scalar(select(Evidence).where(Evidence.project_id==project_id,Evidence.payload['delivery_id'].astext==delivery_id))
        if delivered and delivered.source_key != f'github:{run_id}:{attempt}':
            raise HTTPException(409, 'Delivery ID was already used for another run')
    task = db.scalar(select(Task).where(Task.project_id == project_id, Task.key == task_key))
    if not task: raise HTTPException(422, 'Mapped task is unavailable')
    # Stable across webhook redelivery and explicit local read-only sync.
    key = f'github:{run_id}:{attempt}'
    existing = db.scalar(select(Evidence).where(Evidence.project_id == project_id, Evidence.source_key == key))
    kind = 'ci_pass' if conclusion == 'success' else 'ci_failure'
    if existing:
        if existing.kind != kind or existing.task_id != task.id: raise HTTPException(409, 'Run was already recorded with a different result')
        return {'message': 'Workflow run already recorded'}
    family = f'{repo.casefold()}:{run.get("name")}:{branch}'
    previous = list(db.scalars(select(Evidence).where(Evidence.project_id == project_id, Evidence.task_id == task.id, Evidence.origin == 'github')))
    related = [e for e in previous if e.payload.get('family') == family]
    latest = not any(e.observed_at > observed for e in related)
    if latest:
        for e in related: e.active = False
    url = f'https://github.com/{repo}/actions/runs/{run_id}'
    db.add(Evidence(project_id=project_id, task_id=task.id, source_key=key, kind=kind,
        title=f'{task.key} · {run.get("name")} {conclusion}',
        detail=f'GitHub workflow run {run_id}, attempt {attempt}, branch {branch}: {conclusion}. Source: {url}',
        origin='github', active=latest and kind == 'ci_failure', observed_at=observed,
        payload={'family':family, 'source_url':url, 'transport':source, 'delivery_id':delivery_id, 'received_at':datetime.now(timezone.utc).isoformat()}))
    db.flush(); refresh_findings(db, project_id); db.commit()
    return {'message': 'GitHub workflow evidence recorded'}

@router.post('/webhooks/github')
async def webhook(request: Request, db=Depends(get_db)):
    secret = os.getenv('GITHUB_WEBHOOK_SECRET')
    if not secret: raise HTTPException(503, 'GitHub webhook is not configured')
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 1_000_000: raise HTTPException(413, 'Webhook payload exceeds the local limit')
    expected = 'sha256=' + hmac.new(secret.encode(), bytes(raw), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get('x-hub-signature-256', '')):
        raise HTTPException(403, 'Invalid webhook signature')
    try: UUID(request.headers.get('x-github-delivery', ''))
    except ValueError: raise HTTPException(422, 'A delivery UUID is required')
    if request.headers.get('x-github-event') != 'workflow_run': return {'message': 'Ignored unsupported event'}
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict): raise ValueError()
    except ValueError: raise HTTPException(422, 'Invalid webhook JSON')
    return ingest(db, payload, delivery_id=request.headers['x-github-delivery'])
