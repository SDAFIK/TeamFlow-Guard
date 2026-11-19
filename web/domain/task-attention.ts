type AttentionTask = { id: string; key: string; status: string; priority: string; due_at?: string | null };

export type DueState = "complete" | "overdue" | "soon" | "scheduled" | "unscheduled";

export function dueState(dueAt: string | null | undefined, status: string, now = new Date()): DueState {
  if (status === "done") return "complete";
  const timestamp = dueAt ? Date.parse(dueAt) : NaN;
  if (!Number.isFinite(timestamp)) return "unscheduled";
  if (timestamp < now.getTime()) return "overdue";
  if (timestamp - now.getTime() <= 7 * 86400000) return "soon";
  return "scheduled";
}

/** Work requiring an imminent decision: blocked, overdue or due in the next seven days. */
export function needsAttention(task: Pick<AttentionTask, "status" | "due_at">, now = new Date()): boolean {
  if (task.status === "done") return false;
  const timing = dueState(task.due_at, task.status, now);
  return task.status === "blocked" || timing === "overdue" || timing === "soon";
}

const priorityWeight: Record<string, number> = { critical: 3, high: 2, normal: 1 };
const dueWeight: Record<DueState, number> = { overdue: 4, soon: 2, scheduled: 1, unscheduled: 0, complete: -1 };

export function sortTasksByAttention<T extends AttentionTask>(tasks: readonly T[], now = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const score = (task: T) => (task.status === "blocked" ? 100 : 0)
      + dueWeight[dueState(task.due_at, task.status, now)] * 10
      + (priorityWeight[task.priority] ?? 0);
    return score(b) - score(a) || a.key.localeCompare(b.key);
  });
}
