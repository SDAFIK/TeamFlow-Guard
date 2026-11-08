from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select, func, text
from .models import PlanVersion, Task, TaskDependency, AuditEvent, Membership
from .graph import validate_dag

def lock_project(db, project_id):
    # Serialize all plan writers without granting UPDATE on project metadata.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:id, 0))"), {'id': str(project_id)})
    db.expire_all()

def current_version(db, project_id):
    return db.scalar(select(func.max(PlanVersion.number)).where(PlanVersion.project_id == project_id)) or 1

def advance_plan(db, project_id):
    number = current_version(db, project_id) + 1
    db.add(PlanVersion(project_id=project_id, number=number)); db.flush()
    return number

def snapshot(db, project_id):
    tasks = list(db.scalars(select(Task).where(Task.project_id == project_id).order_by(Task.position, Task.key)))
    edges = [(e.predecessor_id,e.successor_id) for e in db.scalars(select(TaskDependency).where(TaskDependency.project_id == project_id))]
    return tasks, edges

def audit(db, project_id, actor_id, kind, summary, changes, version=None):
    event = AuditEvent(project_id=project_id, actor_id=actor_id, kind=kind, summary=summary, changes=changes, plan_version=version or current_version(db,project_id))
    db.add(event); db.flush()
    return event

def validate_actions(db, project_id, actions):
    tasks, edges = snapshot(db, project_id)
    by_id = {str(t.id): t for t in tasks}; seen = set()
    review_assignments = {str(t.id): t.reviewer_id for t in tasks if t.status != 'done'}
    changed_reviewers = set()
    for action in actions:
        task = by_id.get(str(action['task_id']))
        field = action['field']; before = action['before']; after = action['after']
        if not task: raise HTTPException(422, 'Proposal references an unavailable task')
        if task.status == 'done': raise HTTPException(422, 'Completed tasks cannot be changed by a proposal')
        if (str(task.id),field) in seen: raise HTTPException(422, 'Duplicate changes to the same task field')
        seen.add((str(task.id),field))
        if field == 'dependency':
            if before is not None or str(after) not in by_id: raise HTTPException(422, 'Invalid dependency task')
            edge = (UUID(str(after)),task.id)
            if edge in edges: raise HTTPException(422, 'Dependency already exists')
            edges.append(edge)
        else:
            actual = getattr(task,field)
            if isinstance(actual,UUID): actual = str(actual)
            if actual != before: raise HTTPException(409, 'A before-value has changed; regenerate this proposal')
            if actual == after: raise HTTPException(422, 'Proposal does not change this field')
            if field == 'reviewer_id':
                try: target = UUID(str(after))
                except ValueError: raise HTTPException(422, 'Invalid reviewer ID')
                member = db.get(Membership,(project_id,target))
                if not member or member.role not in ('reviewer','lead') or member.available_hours < 2:
                    raise HTTPException(422, 'Reviewer must belong to this project, have a reviewer/lead role and at least two available hours')
                review_assignments[str(task.id)] = target
                changed_reviewers.add(target)
            elif field == 'priority' and after not in ('normal','high','critical'):
                raise HTTPException(422, 'Invalid priority')
            elif field == 'position' and (type(after) is not int or not 0 <= after < len(tasks)):
                raise HTTPException(422, 'Position must be a valid task order index')
    for target in changed_reviewers:
        assigned = sum(reviewer == target for reviewer in review_assignments.values())
        if assigned * 2 > db.get(Membership,(project_id,target)).available_hours:
            raise HTTPException(422, 'Reviewer has insufficient available review hours')
    try: validate_dag(by_id,edges)
    except ValueError as exc: raise HTTPException(422,str(exc))
    return by_id

def apply_actions(db, project_id, actions, version):
    by_id = validate_actions(db,project_id,actions)
    before_values = {key:{field:getattr(task,field) for field in ('reviewer_id','priority','position')} for key,task in by_id.items()}
    for action in actions:
        task = by_id[str(action['task_id'])]
        field, value = action['field'], action['after']
        if field == 'dependency':
            db.add(TaskDependency(project_id=project_id,predecessor_id=UUID(str(value)),successor_id=task.id))
        elif field == 'reviewer_id': task.reviewer_id = UUID(str(value))
        elif field == 'position':
            old = task.position
            for other in by_id.values():
                if other.id == task.id: continue
                if value <= other.position < old: other.position += 1; other.version += 1; other.plan_version = version
                elif old < other.position <= value: other.position -= 1; other.version += 1; other.plan_version = version
            task.position = value
        else: setattr(task,field,value)
        task.version += 1; task.plan_version = version
    changes = [action for action in actions if action['field']=='dependency']
    for key, task in by_id.items():
        for field, before in before_values[key].items():
            after = getattr(task,field)
            if before != after:
                changes.append({'task_id':key,'field':field,'before':str(before) if isinstance(before,UUID) else before,'after':str(after) if isinstance(after,UUID) else after})
    return changes
