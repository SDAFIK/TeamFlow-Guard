from sqlalchemy import select
from fastapi import HTTPException
from .models import Membership, Task, RecoveryProposal
from .plan import validate_actions, current_version, snapshot
from .schemas import ProposalView

def candidates(db, project_id, root_task):
    """Only validated options reach the model. These remain proposals, never writes."""
    options=[]
    members=list(db.scalars(select(Membership).where(Membership.project_id==project_id).order_by(Membership.available_hours.desc(),Membership.user_id)))
    for member in members:
        if member.role in ('reviewer','lead') and member.user_id!=root_task.reviewer_id:
            action={'task_id':str(root_task.id),'field':'reviewer_id','before':str(root_task.reviewer_id) if root_task.reviewer_id else None,'after':str(member.user_id)}
            try: validate_actions(db,project_id,[action])
            except HTTPException: continue
            options.append(action);break
    if root_task.priority != 'critical': options.append({'task_id':str(root_task.id),'field':'priority','before':root_task.priority,'after':'critical'})
    tasks,edges=snapshot(db,project_id)
    connected={str(a) for edge in edges for a in edge}
    independent=next((t for t in tasks if str(t.id) not in connected and t.status not in ('done','blocked') and t.position>0),None)
    if independent:
        options.append({'task_id':str(independent.id),'field':'position','before':independent.position,'after':0})
    valid=[]
    for option in options:
        try: validate_actions(db,project_id,[option]);valid.append(option)
        except HTTPException: pass
    return valid

def proposal_view(proposal, version):
    return ProposalView(id=proposal.id,title=proposal.title,explanation=proposal.explanation,source=proposal.source,base_plan_version=proposal.base_plan_version,actions=proposal.actions,evidence_ids=proposal.evidence_ids,assumptions=proposal.assumptions,status=proposal.status,stale=proposal.status=='pending' and proposal.base_plan_version!=version,risk_id=proposal.risk_id,created_at=proposal.created_at)
