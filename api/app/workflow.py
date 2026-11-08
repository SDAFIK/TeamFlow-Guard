import hashlib
import json
import os
import time
from datetime import datetime,timezone,timedelta
from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException,Header
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from .db import get_db
from .security import current_user,membership,require_origin
from .models import Task,TaskDependency,Membership,Project,Evidence,RiskFinding,RecoveryProposal,AuditEvent,User,DecisionReceipt,AnalysisRun
from .schemas import StatusUpdate,TaskView,GraphView,Edge,ProposalInput,ProposalView,RiskView,DemoEventInput,AvailabilityInput,Message,DecisionInput,DecisionResult,AuditView,IntegrationStatus
from .plan import lock_project,current_version,advance_plan,snapshot,audit,validate_actions,apply_actions
from .graph import reachable,validate_dag
from .risks import refresh_findings,list_risks
from .recovery import candidates,proposal_view
from . import ai
from .github import configuration as github_configuration

router=APIRouter(prefix='/api')
write=[Depends(require_origin)]

def scoped_task(db,task_id,user):
    task=db.get(Task,task_id)
    if not task: raise HTTPException(404,'Task is unavailable')
    member=membership(db,task.project_id,user)
    return task,member

def require_lead(member):
    if member.role!='lead': raise HTTPException(403,'A project lead must authorize this action')

@router.patch('/tasks/{task_id}',response_model=TaskView,dependencies=write)
def update_status(task_id:UUID,data:StatusUpdate,user=Depends(current_user),db:Session=Depends(get_db)):
    task,member=scoped_task(db,task_id,user)
    if member.role!='lead' and task.owner_id!=user.id: raise HTTPException(403,'Only the assignee or project lead can update this task')
    project_id=task.project_id;lock_project(db,project_id)
    if task.version!=data.expected_version: raise HTTPException(409,'Task changed since you opened it. Refresh and try again.')
    if task.status==data.status: return task
    if task.status=='done': raise HTTPException(422,'Completed work is preserved; create a follow-up task instead')
    before=task.status;task.status=data.status;task.version+=1;task.plan_version=advance_plan(db,project_id)
    now=datetime.now(timezone.utc)
    if data.status=='blocked':
        db.add(Evidence(project_id=project_id,task_id=task.id,source_key=f'status:{task.id}:{task.version}',kind='dependency',title=f'{task.key} reported blocked',detail=data.note or 'Assignee or project lead reported a blocker.',origin='manual',active=True,payload={},observed_at=now))
    if data.status!='blocked':
        for item in db.scalars(select(Evidence).where(Evidence.task_id==task.id,Evidence.kind=='dependency',Evidence.active.is_(True))): item.active=False
    audit(db,project_id,user.id,'task.status',f'{task.key}: {before} → {data.status}',[{'task_id':str(task.id),'field':'status','before':before,'after':data.status}],task.plan_version)
    db.flush();refresh_findings(db,project_id);db.commit();return task

@router.get('/projects/{project_id}/dependencies',response_model=GraphView)
def dependencies(project_id:UUID,selected:UUID|None=None,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user);tasks,edges=snapshot(db,project_id);ids=[t.id for t in tasks]
    try:
        downstream=reachable(ids,edges,selected) if selected else []
        upstream=reachable(ids,edges,selected,reverse=True) if selected else []
    except ValueError as exc: raise HTTPException(404,str(exc))
    return GraphView(nodes=[TaskView.model_validate(t) for t in tasks],edges=[Edge(predecessor_id=a,successor_id=b) for a,b in edges],plan_version=current_version(db,project_id),selected_task_id=selected,downstream_ids=downstream,upstream_ids=upstream)

@router.post('/projects/{project_id}/dependencies/validate',response_model=Message,dependencies=write)
def validate_edge(project_id:UUID,edge:Edge,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user);tasks,edges=snapshot(db,project_id)
    try: validate_dag([t.id for t in tasks],edges+[(edge.predecessor_id,edge.successor_id)])
    except ValueError as exc: raise HTTPException(422,str(exc))
    return {'message':'Dependency is acyclic and project-scoped. Submit a proposal to apply it.'}

@router.get('/projects/{project_id}/risks',response_model=list[RiskView])
def risks(project_id:UUID,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user);return list_risks(db,project_id)

@router.post('/projects/{project_id}/demo-events',response_model=list[RiskView],dependencies=write)
def demo_event(project_id:UUID,data:DemoEventInput,user=Depends(current_user),db:Session=Depends(get_db)):
    member=membership(db,project_id,user);require_lead(member)
    if not db.get(Project,project_id).is_demo: raise HTTPException(403,'Replay is restricted to demo projects')
    task=db.get(Task,data.task_id)
    if not task or task.project_id!=project_id: raise HTTPException(422,'Task is not in this project')
    lock_project(db,project_id)
    existing=db.scalar(select(Evidence).where(Evidence.project_id==project_id,Evidence.source_key==data.event_key))
    if existing:
        if existing.kind!=data.kind or existing.task_id!=data.task_id: raise HTTPException(409,'Event key was used for a different event')
        return list_risks(db,project_id)
    now=datetime.now(timezone.utc)
    titles={'ci_failure':'CI check failed','ci_pass':'CI check passed','review_delay':'PR review waiting 48 hours','capacity':'Owner unavailable for two days'}
    details={'ci_failure':'Simulated check #921 failed in login-ui tests. This is a replay, not a live GitHub observation.','ci_pass':'Simulated passing check received. Earlier replayed CI failures on this task are cleared.','review_delay':'Simulated review has waited 48 hours, above the project threshold of 24 hours.','capacity':'Demo scenario: the fictional owner reports no available hours for the next two working days.'}
    evidence=Evidence(project_id=project_id,task_id=task.id,source_key=data.event_key,kind=data.kind,title=f'{task.key} · {titles[data.kind]}',detail=details[data.kind],origin='replay',active=data.kind!='ci_pass',payload={'waiting_hours':48} if data.kind=='review_delay' else {},observed_at=now)
    db.add(evidence);db.flush()
    if data.kind!='ci_pass':
        for previous in db.scalars(select(Evidence).where(Evidence.project_id==project_id,Evidence.task_id==task.id,Evidence.kind==data.kind,Evidence.origin=='replay',Evidence.id!=evidence.id)):
            previous.active=False
    if data.kind=='ci_pass':
        for item in db.scalars(select(Evidence).where(Evidence.project_id==project_id,Evidence.task_id==task.id,Evidence.kind=='ci_failure',Evidence.origin=='replay')): item.active=False
    if data.kind=='capacity':
        owner=db.get(Membership,(project_id,task.owner_id));owner.available_hours=0
        advance_plan(db,project_id)
    db.flush();refresh_findings(db,project_id)
    audit(db,project_id,user.id,'demo.replay',f'Replayed {data.kind} for {task.key}',[{'evidence_id':str(evidence.id),'origin':'replay'}])
    db.commit();return list_risks(db,project_id)

@router.put('/projects/{project_id}/availability',response_model=Message,dependencies=write)
def availability(project_id:UUID,data:AvailabilityInput,user=Depends(current_user),db:Session=Depends(get_db)):
    member=membership(db,project_id,user);lock_project(db,project_id)
    before=member.available_hours;member.available_hours=data.hours
    version=advance_plan(db,project_id)
    for task in db.scalars(select(Task).where(Task.project_id==project_id,Task.owner_id==user.id,Task.status!='done')):
        for previous in db.scalars(select(Evidence).where(Evidence.project_id==project_id,Evidence.task_id==task.id,Evidence.kind=='capacity',Evidence.active.is_(True))): previous.active=False
        db.add(Evidence(project_id=project_id,task_id=task.id,source_key=f'availability:{user.id}:{version}:{task.id}',kind='capacity',title=f'{task.key} · reported availability',detail=f'Member voluntarily reported {data.hours} available hours.',origin='manual',active=True,payload={},observed_at=datetime.now(timezone.utc)))
    db.flush();refresh_findings(db,project_id)
    audit(db,project_id,user.id,'availability.updated','Voluntary availability updated',[{'field':'available_hours','before':before,'after':data.hours}],version)
    db.commit();return {'message':'Your availability has been saved.'}

@router.get('/projects/{project_id}/proposals',response_model=list[ProposalView])
def proposals(project_id:UUID,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user);version=current_version(db,project_id)
    return [proposal_view(p,version) for p in db.scalars(select(RecoveryProposal).where(RecoveryProposal.project_id==project_id).order_by(RecoveryProposal.created_at.desc()))]

@router.post('/projects/{project_id}/proposals',response_model=ProposalView,dependencies=write)
def manual_proposal(project_id:UUID,data:ProposalInput,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user);lock_project(db,project_id)
    version=current_version(db,project_id)
    if version!=data.base_plan_version: raise HTTPException(409,'Plan changed; refresh before proposing')
    actions=[a.model_dump(mode='json') for a in data.actions];validate_actions(db,project_id,actions)
    proposal=RecoveryProposal(project_id=project_id,created_by=user.id,title=data.title,explanation='A team member proposed this change. Review the before/after values and current constraints before approving.',source='manual',base_plan_version=version,actions=actions,evidence_ids=[],assumptions=['This is a human-authored proposal, not AI analysis.'],status='pending')
    db.add(proposal);db.commit();return proposal_view(proposal,version)

@router.post('/risks/{risk_id}/analyze',response_model=ProposalView,dependencies=write)
def analyze_risk(risk_id:UUID,mode:str='openai',user=Depends(current_user),db:Session=Depends(get_db)):
    if mode not in ('openai','rules'): raise HTTPException(422,'Unknown analysis mode')
    finding=db.get(RiskFinding,risk_id)
    if not finding: raise HTTPException(404,'Risk is unavailable')
    project_id=finding.project_id;membership(db,project_id,user)
    lock_project(db,project_id)
    if not finding.active: raise HTTPException(409,'This risk is resolved. Refresh the risk queue.')
    evidence=db.get(Evidence,finding.evidence_id);task=db.get(Task,evidence.task_id)
    options=candidates(db,project_id,task)
    if not options: raise HTTPException(422,'No feasible recovery change was found. Review the evidence and plan manually.')
    version=current_version(db,project_id)
    context={'risk':finding.reason,'task':{'id':str(task.id),'key':task.key,'title':task.title},'evidence':[{'id':str(evidence.id),'title':evidence.title,'detail':evidence.detail[:1500],'origin':evidence.origin}],'candidates':options}
    evidence_id=str(evidence.id)
    if mode=='rules':
        title=f'Recovery plan for {task.key}';explanation=f'{finding.reason} Consider the validated reviewer, priority and independent-work changes below. These rules do not repair the failed check or guarantee a release date.'
        actions=options;assumptions=['Rule-based suggestion; no AI request was made.','A passing CI event is still needed to clear any failed check.','Reviewer allocation assumes two hours per review.']
    else:
        recent=db.scalar(select(func.count()).select_from(AnalysisRun).where(AnalysisRun.project_id==project_id,AnalysisRun.created_at>datetime.now(timezone.utc)-timedelta(hours=1)))
        if recent>=10: raise HTTPException(429,'Project analysis limit reached (10 per hour). Try a rule-based proposal.')
        if not ai.configured(): raise HTTPException(503,'OpenAI is not configured. Use a rule-based proposal or configure the server API key and model.')
        run=AnalysisRun(project_id=project_id,risk_id=risk_id,provider='openai',model=os.environ['OPENAI_MODEL'],prompt_version=ai.PROMPT_VERSION,status='pending',latency_ms=0,usage={})
        db.add(run);db.flush();run_id=run.id;db.commit() # release all locks before the network call
        start=time.monotonic()
        try:
            result,usage,latency=ai.analyze(context)
        except ai.ProviderFailure as exc:
            run=db.get(AnalysisRun,run_id);run.status='failed';run.latency_ms=round((time.monotonic()-start)*1000);db.commit()
            raise HTTPException(503,str(exc))
        lock_project(db,project_id)
        run=db.get(AnalysisRun,run_id);run.status='completed';run.latency_ms=latency;run.usage=usage
        if current_version(db,project_id)!=version or not db.get(RiskFinding,risk_id).active:
            run.status='stale';db.commit();raise HTTPException(409,'The plan changed during analysis; regenerate the proposal.')
        title=result.title;explanation=result.explanation;actions=[options[i] for i in result.action_indices];assumptions=result.assumptions
    try:
        validate_actions(db,project_id,actions)
    except HTTPException:
        if mode=='openai':
            run.status='failed';db.commit()
        raise
    proposal=RecoveryProposal(project_id=project_id,risk_id=risk_id,created_by=user.id,title=title,explanation=explanation,source=mode,base_plan_version=version,actions=actions,evidence_ids=[evidence_id],assumptions=assumptions,status='pending')
    db.add(proposal);db.commit();return proposal_view(proposal,version)

@router.post('/proposals/{proposal_id}/decision',response_model=DecisionResult,dependencies=write)
def decide(proposal_id:UUID,data:DecisionInput,idempotency_key:str=Header(min_length=8,max_length=120),user=Depends(current_user),db:Session=Depends(get_db)):
    proposal=db.get(RecoveryProposal,proposal_id)
    if not proposal: raise HTTPException(404,'Proposal is unavailable')
    project_id=proposal.project_id;member=membership(db,project_id,user);require_lead(member)
    lock_project(db,project_id)
    require_lead(membership(db,project_id,user))
    request_hash=hashlib.sha256(json.dumps({'proposal_id':str(proposal_id),**data.model_dump()},sort_keys=True).encode()).hexdigest()
    receipt=db.scalar(select(DecisionReceipt).where(DecisionReceipt.project_id==project_id,DecisionReceipt.actor_id==user.id,DecisionReceipt.idempotency_key==idempotency_key))
    if receipt:
        if receipt.request_hash!=request_hash: raise HTTPException(409,'Idempotency key was used for a different decision')
        return receipt.result
    if proposal.status!='pending': raise HTTPException(409,'This proposal has already been decided')
    version=current_version(db,project_id)
    if data.base_plan_version!=proposal.base_plan_version: raise HTTPException(409,'Proposal version does not match the review')
    if data.decision=='approve':
        if proposal.base_plan_version!=version: raise HTTPException(409,'This proposal is stale. Regenerate it against the current plan.')
        if proposal.risk_id:
            finding=db.get(RiskFinding,proposal.risk_id)
            if not finding.active: raise HTTPException(409,'The source risk is resolved; review a new proposal instead')
        validate_actions(db,project_id,proposal.actions)
        version=advance_plan(db,project_id);applied_changes=apply_actions(db,project_id,proposal.actions,version)
        proposal.status='approved';db.flush();refresh_findings(db,project_id)
    else: proposal.status='rejected'
    event=audit(db,project_id,user.id,f'proposal.{proposal.status}',f'{proposal.title} — {proposal.status}',applied_changes if data.decision=='approve' else [],version)
    result=DecisionResult(proposal_id=proposal.id,status=proposal.status,plan_version=version,audit_id=event.id)
    db.add(DecisionReceipt(project_id=project_id,actor_id=user.id,idempotency_key=idempotency_key,request_hash=request_hash,result=result.model_dump(mode='json')))
    db.commit();return result

@router.get('/projects/{project_id}/audit',response_model=list[AuditView])
def audit_log(project_id:UUID,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user)
    rows=db.execute(select(AuditEvent,User.name).join(User,AuditEvent.actor_id==User.id).where(AuditEvent.project_id==project_id).order_by(AuditEvent.created_at.desc()).limit(100))
    return [AuditView(id=e.id,actor_name=name,kind=e.kind,summary=e.summary,plan_version=e.plan_version,changes=e.changes,created_at=e.created_at) for e,name in rows]

@router.get('/projects/{project_id}/integrations',response_model=IntegrationStatus)
def integrations(project_id:UUID,user=Depends(current_user),db:Session=Depends(get_db)):
    membership(db,project_id,user)
    config=github_configuration()
    return IntegrationStatus(ai_configured=ai.configured(),ai_provider='openai',ai_model=os.getenv('OPENAI_MODEL'),github_configured=bool(config and config[0]==project_id),mode='local')
