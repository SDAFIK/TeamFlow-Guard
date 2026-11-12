import type { ProposedAction } from "./proposal";
export type RecoveryOption = { id: string; title: string; effect: string; tradeoff: string; actions: ProposedAction[] };
type Task = { id: string; owner_id: string; reviewer_id: string | null; estimate_hours: number; status: string; position: number; priority: string; title: string };
type Member = { id: string; name: string; role: string; available_hours: number; availability_start?: string | null; availability_end?: string | null };
export function githubReviewReviewer(e:{kind:string;payload:Record<string,unknown>}){
  return e.kind==="review_delay"&&e.payload.ingestion==="github-review-reconciliation"&&typeof e.payload.reviewer_id==="string"?e.payload.reviewer_id:undefined;
}
export function buildRecoveryOptions(tasks: Task[], edges: { successor_id: string }[], members: Member[], taskId: string, kind: string, now = Date.now(), observedReviewerId?:string): RecoveryOption[] {
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status === 'done') return [];
  const options: RecoveryOption[] = [];
  const currentCapacity = (m: Member) => m.role !== 'viewer' && (!m.availability_start || Date.parse(m.availability_start) <= now) && (!m.availability_end || Date.parse(m.availability_end) > now);
  if (kind === 'capacity') {
    const owner = members.filter(m => m.id !== task.owner_id && m.id !== task.reviewer_id && currentCapacity(m))
      .map(m => ({ member: m, remaining: m.available_hours - tasks.filter(t => t.owner_id === m.id && t.status !== 'done').reduce((sum, t) => sum + t.estimate_hours, 0) }))
      .filter(m => m.remaining >= task.estimate_hours).sort((a, b) => b.remaining - a.remaining)[0];
    if (owner) options.push({ id: 'coverage', title: `Move ownership to ${owner.member.name}`, effect: 'Move the affected task to a teammate with enough reported hours after existing estimates.', tradeoff: 'Confirm skills and handoff time with the teammate. Estimates are not a delivery guarantee.', actions: [{ task_id: task.id, field: 'owner_id', before: task.owner_id, after: owner.member.id }] });
  } else {
    const reviewer = members.find(m => currentCapacity(m) && m.id !== task.owner_id && m.id !== task.reviewer_id && m.id!==observedReviewerId && (!observedReviewerId || (Number.isFinite(Date.parse(m.availability_start??""))&&Number.isFinite(Date.parse(m.availability_end??"")))) && m.available_hours >= 2 + tasks.filter(t => t.reviewer_id === m.id && t.status !== 'done').length * 2);
    if (reviewer) options.push({ id: 'coverage', title: `Ask ${reviewer.name} to review`, effect: 'Assign review coverage using reported availability.', tradeoff: observedReviewerId ? 'Changes TeamFlow review coverage only. Request the review separately on GitHub; assumes two hours per review.' : 'Assumes two hours per review. A review assignment does not repair a failing build or remove a blocker.', actions: [{ task_id: task.id, field: 'reviewer_id', before: task.reviewer_id, after: reviewer.id }] });
  }
  if (task.priority !== 'critical') options.push({ id: 'priority', title: 'Escalate this task', effect: 'Mark the affected task critical so the team can prioritize intervention.', tradeoff: 'Keeps the current owner. Priority alone does not add capacity or clear the source problem.', actions: [{ task_id: task.id, field: 'priority', before: task.priority, after: 'critical' }] });
  const independent = tasks.find(t => t.id !== taskId && t.status !== 'done' && t.position > 0 && !edges.some(e => e.successor_id === t.id));
  if (independent) options.push({ id: 'sequence', title: `Bring ${independent.title} forward`, effect: 'Move independent work to the front while the affected task is addressed.', tradeoff: 'Changes the order of other tasks. The original risk remains and still needs an owner.', actions: [{ task_id: independent.id, field: 'position', before: independent.position, after: 0 }] });
  return options;
}
