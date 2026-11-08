"""Evidence-driven rule engine. Inferences never alter observed task statuses."""
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from .models import Evidence, RiskFinding, Task, Membership
from .plan import snapshot
from .graph import reachable
from .schemas import RiskView, EvidenceView

def classify(kind, task, affected_count, payload, available_hours=40):
    if task.status == 'done': return None
    if kind == 'ci_failure':
        return ('high' if affected_count else 'medium', f'An observed failing check is linked to {task.key}; {affected_count} unfinished downstream tasks depend on it.')
    if kind == 'dependency' and task.status == 'blocked':
        return ('high' if affected_count else 'medium', f'{task.key} is explicitly blocked; {affected_count} unfinished successors are exposed.')
    if kind == 'review_delay' and payload.get('waiting_hours',0) > 24:
        return ('medium', f'Review has been pending for {payload["waiting_hours"]} hours, above the 24-hour threshold.')
    if kind == 'capacity' and available_hours < task.estimate_hours:
        return ('high' if available_hours == 0 else 'medium', f'Owner availability is {available_hours} hours against {task.estimate_hours} estimated hours for this task. This is reported availability, not inferred productivity.')
    return None

def refresh_findings(db, project_id):
    tasks, edges = snapshot(db,project_id)
    by_id = {str(t.id):t for t in tasks}
    memberships = {m.user_id:m for m in db.scalars(select(Membership).where(Membership.project_id==project_id))}
    for evidence in db.scalars(select(Evidence).where(Evidence.project_id==project_id)):
        task = by_id.get(str(evidence.task_id))
        finding = db.scalar(select(RiskFinding).where(RiskFinding.evidence_id==evidence.id))
        if not task: continue
        affected = [i for i in reachable(by_id,edges,task.id) if by_id[i].status!='done']
        member = memberships.get(task.owner_id)
        result = classify(evidence.kind,task,len(affected),evidence.payload,member.available_hours if member else 0) if evidence.active else None
        if result:
            if not finding:
                finding=RiskFinding(project_id=project_id,evidence_id=evidence.id);db.add(finding)
            finding.severity,finding.reason=result
            finding.affected_task_ids=affected;finding.active=True;finding.updated_at=datetime.now(timezone.utc)
        elif finding:
            finding.active=False;finding.updated_at=datetime.now(timezone.utc)
    db.flush()

def risk_view(finding, evidence):
    return RiskView(id=finding.id,severity=finding.severity,reason=finding.reason,affected_task_ids=finding.affected_task_ids,active=finding.active,evidence=EvidenceView.model_validate(evidence),stale_evidence=evidence.observed_at < datetime.now(timezone.utc)-timedelta(hours=72))

def list_risks(db, project_id):
    rows=db.execute(select(RiskFinding,Evidence).join(Evidence).where(RiskFinding.project_id==project_id).order_by(RiskFinding.active.desc(),RiskFinding.updated_at.desc()))
    return [risk_view(f,e) for f,e in rows]
