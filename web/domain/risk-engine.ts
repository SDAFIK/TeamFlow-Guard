import { downstream, type Edge } from "./graph";
export type RiskTask = { id: string; key: string; status: string; owner_id: string; estimate_hours: number };
export type EvidenceRecord = {
  id: string; task_id: string; kind: string; title: string; detail: string; origin: string;
  active: boolean; observed_at: string; payload: Record<string, unknown>;
};
export type Availability = { id: string; available_hours: number; availability_start?: string | null; availability_end?: string | null };
export function detectRisk(e: EvidenceRecord, task: RiskTask, affected: number, member: Availability | undefined, now: Date, threshold = 24) {
  if (!e.active || task.status === "done") return null;
  const high = affected > 0 ? "high" : "medium";
  if (e.kind === "ci_failure") {
    if (e.payload.branch !== e.payload.tracked_branch || !e.payload.branch || !["failure", "timed_out"].includes(String(e.payload.conclusion))) return null;
    return { severity: high, reason: `Failed check mapped to ${task.key} on tracked branch ${e.payload.branch}; ${affected} unfinished downstream tasks.` };
  }
  if (e.kind === "dependency" && task.status === "blocked") return { severity: high, reason: `${task.key} is explicitly blocked; ${affected} unfinished downstream tasks.` };
  if (e.kind === "review_delay") {
    if (e.payload.state !== "open" || e.payload.is_draft !== false || !e.payload.reviewer_id) return null;
    const requested = Date.parse(String(e.payload.review_requested_at));
    const hours = (now.getTime() - requested) / 3_600_000;
    if (!Number.isFinite(hours) || hours <= threshold) return null;
    return { severity: "medium", reason: `Open, non-draft PR review has waited ${Math.floor(hours)} hours (threshold ${threshold} hours). Waiting is not a performance rating.` };
  }
  if (e.kind === "capacity" && member) {
    const start = Date.parse(member.availability_start ?? "");
    const end = Date.parse(member.availability_end ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || now.getTime() < start || now.getTime() >= end || affected === 0) return null;
    if (member.available_hours < task.estimate_hours) return { severity: member.available_hours === 0 ? "high" : "medium", reason: `Voluntarily reported availability is ${member.available_hours} hours against ${task.estimate_hours} estimated hours on ${task.key}, with ${affected} unfinished successors. Availability is not productivity.` };
  }
  return null;
}
export function risksFor(tasks: RiskTask[], edges: Edge[], evidence: EvidenceRecord[], members: Availability[], threshold = 24, now = new Date(), trackedBranch?: string) {
  return evidence.flatMap(e => {
    const task = tasks.find(t => t.id === e.task_id);
    if (!task) return [];
    const affected = downstream(tasks.map(t => t.id), edges, task.id).filter(id => tasks.find(t => t.id === id)?.status !== "done");
    const source=trackedBranch&&e.kind==='ci_failure'?{...e,payload:{...e.payload,tracked_branch:trackedBranch}}:e;
    const finding = detectRisk(source, task, affected.length, members.find(m => m.id === task.owner_id), now, threshold);
    return [{ id: e.id, severity: finding?.severity ?? "low", reason: finding?.reason ?? "This source no longer meets the risk rule.", affected_task_ids: affected, active: Boolean(finding), evidence: e, stale_evidence: now.getTime() - Date.parse(e.observed_at) > 72 * 3_600_000 }];
  }).sort((a, b) => Number(b.active) - Number(a.active));
}
