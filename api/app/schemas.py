from datetime import datetime
from uuid import UUID
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class LoginInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

class Person(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    email: str

class ProjectSummary(BaseModel):
    id: UUID
    name: str
    role: Literal['lead','contributor','reviewer','viewer']

class Member(Person):
    role: str
    specialty: str
    available_hours: int

class TaskView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    key: str
    title: str
    description: str
    status: Literal['todo','in_progress','blocked','done']
    owner_id: UUID
    position: int
    version: int
    reviewer_id: UUID | None
    priority: str
    estimate_hours: int
    due_at: datetime | None = None

class Overview(BaseModel):
    project: ProjectSummary
    description: str
    is_demo: bool
    fixture_label: str
    plan_version: int
    as_of: datetime
    tasks: list[TaskView]
    members: list[Member]
    counts: dict[str, int]

class Message(BaseModel):
    message: str

class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['todo','in_progress','blocked','done']
    expected_version: int = Field(ge=1)
    note: str = Field(default='', max_length=500)

class Edge(BaseModel):
    predecessor_id: UUID
    successor_id: UUID

class GraphView(BaseModel):
    nodes: list[TaskView]
    edges: list[Edge]
    plan_version: int
    selected_task_id: UUID | None
    downstream_ids: list[UUID]
    upstream_ids: list[UUID]

class Action(BaseModel):
    model_config = ConfigDict(extra='forbid')
    task_id: UUID
    field: Literal['reviewer_id','priority','position','dependency','owner_id','due_at']
    before: str | int | None
    after: str | int

class ProposalInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=3, max_length=140)
    base_plan_version: int = Field(ge=1)
    actions: list[Action] = Field(min_length=1, max_length=8)

class ProposalView(BaseModel):
    id: UUID
    title: str
    explanation: str
    source: str
    base_plan_version: int
    actions: list[Action]
    evidence_ids: list[UUID]
    assumptions: list[str]
    status: str
    stale: bool
    risk_id: UUID | None
    created_at: datetime

class EvidenceView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    task_id: UUID
    kind: str
    title: str
    detail: str
    origin: str
    active: bool
    observed_at: datetime

class RiskView(BaseModel):
    id: UUID
    severity: str
    reason: str
    affected_task_ids: list[UUID]
    active: bool
    evidence: EvidenceView
    stale_evidence: bool

class DemoEventInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['ci_failure','ci_pass','review_delay','capacity']
    task_id: UUID
    event_key: str = Field(min_length=8,max_length=100)

class AvailabilityInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    hours: int = Field(ge=0,le=80)

class DecisionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    decision: Literal['approve','reject']
    base_plan_version: int = Field(ge=1)

class DecisionResult(BaseModel):
    proposal_id: UUID
    status: str
    plan_version: int
    audit_id: UUID

class AuditView(BaseModel):
    id: UUID
    actor_name: str
    kind: str
    summary: str
    plan_version: int
    changes: list[dict]
    created_at: datetime

class IntegrationStatus(BaseModel):
    ai_configured: bool
    ai_provider: str | None
    ai_model: str | None
    github_configured: bool
    mode: str
