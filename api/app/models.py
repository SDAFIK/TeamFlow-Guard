from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, CheckConstraint, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

class User(Base):
    __tablename__ = 'users'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    password_hash: Mapped[str]

class Organization(Base):
    __tablename__ = 'organizations'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str]

class Project(Base):
    __tablename__ = 'projects'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey('organizations.id'), index=True)
    name: Mapped[str]
    description: Mapped[str]
    is_demo: Mapped[bool] = mapped_column(default=True)
    fixture_label: Mapped[str]

class Membership(Base):
    __tablename__ = 'memberships'
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), primary_key=True, index=True)
    role: Mapped[str]
    specialty: Mapped[str]
    available_hours: Mapped[int] = mapped_column(default=40, server_default='40')
    __table_args__ = (CheckConstraint("role IN ('lead','contributor','reviewer')"),)

class PlanVersion(Base):
    __tablename__ = 'plan_versions'
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), primary_key=True)
    number: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint('number > 0'),)

class Task(Base):
    __tablename__ = 'tasks'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    key: Mapped[str]
    title: Mapped[str]
    description: Mapped[str]
    status: Mapped[str]
    owner_id: Mapped[UUID] = mapped_column(index=True)
    position: Mapped[int]
    plan_version: Mapped[int] = mapped_column(default=1)
    version: Mapped[int] = mapped_column(default=1, server_default='1')
    reviewer_id: Mapped[UUID | None] = mapped_column(ForeignKey('users.id'), index=True)
    priority: Mapped[str] = mapped_column(default='normal', server_default='normal')
    estimate_hours: Mapped[int] = mapped_column(default=8, server_default='8')
    __table_args__ = (
        UniqueConstraint('project_id', 'id'), UniqueConstraint('project_id', 'key'),
        ForeignKeyConstraint(['project_id','owner_id'],['memberships.project_id','memberships.user_id']),
        ForeignKeyConstraint(['project_id','plan_version'],['plan_versions.project_id','plan_versions.number']),
        CheckConstraint("status IN ('todo','in_progress','blocked','done')"),
        CheckConstraint("priority IN ('normal','high','critical')"),
        CheckConstraint('version > 0 AND estimate_hours > 0'),
    )

class TaskDependency(Base):
    __tablename__ = 'task_dependencies'
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    predecessor_id: Mapped[UUID] = mapped_column(primary_key=True)
    successor_id: Mapped[UUID] = mapped_column(primary_key=True, index=True)
    __table_args__ = (
        ForeignKeyConstraint(['project_id','predecessor_id'],['tasks.project_id','tasks.id']),
        ForeignKeyConstraint(['project_id','successor_id'],['tasks.project_id','tasks.id']),
        CheckConstraint('predecessor_id <> successor_id'),
    )

class Session(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

class LoginAttempt(Base):
    __tablename__ = 'login_attempts'
    key: Mapped[str] = mapped_column(primary_key=True)
    count: Mapped[int]
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class Evidence(Base):
    __tablename__ = 'evidence'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    task_id: Mapped[UUID] = mapped_column(ForeignKey('tasks.id'), index=True)
    source_key: Mapped[str]
    kind: Mapped[str]
    title: Mapped[str]
    detail: Mapped[str]
    origin: Mapped[str]
    active: Mapped[bool] = mapped_column(default=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('project_id','source_key'),)

class RiskFinding(Base):
    __tablename__ = 'risk_findings'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    evidence_id: Mapped[UUID] = mapped_column(ForeignKey('evidence.id'), unique=True)
    severity: Mapped[str]
    reason: Mapped[str]
    affected_task_ids: Mapped[list] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class RecoveryProposal(Base):
    __tablename__ = 'recovery_proposals'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    risk_id: Mapped[UUID | None] = mapped_column(ForeignKey('risk_findings.id'), index=True)
    created_by: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    title: Mapped[str]
    explanation: Mapped[str]
    source: Mapped[str]
    base_plan_version: Mapped[int]
    actions: Mapped[list] = mapped_column(JSONB)
    evidence_ids: Mapped[list] = mapped_column(JSONB)
    assumptions: Mapped[list] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(default='pending')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint("status IN ('pending','approved','rejected')"),)

class AuditEvent(Base):
    __tablename__ = 'audit_events'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    kind: Mapped[str]
    summary: Mapped[str]
    plan_version: Mapped[int]
    changes: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class DecisionReceipt(Base):
    __tablename__ = 'decision_receipts'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey('users.id'), index=True)
    idempotency_key: Mapped[str]
    request_hash: Mapped[str]
    result: Mapped[dict] = mapped_column(JSONB)
    __table_args__ = (UniqueConstraint('project_id','actor_id','idempotency_key'),)

class AnalysisRun(Base):
    __tablename__ = 'analysis_runs'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey('projects.id'), index=True)
    risk_id: Mapped[UUID] = mapped_column(ForeignKey('risk_findings.id'), index=True)
    provider: Mapped[str]
    model: Mapped[str]
    prompt_version: Mapped[str]
    status: Mapped[str]
    latency_ms: Mapped[int]
    usage: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
