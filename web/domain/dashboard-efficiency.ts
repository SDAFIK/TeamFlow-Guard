/**
 * Dashboard-derived counts and search results.
 * Pure helpers: no API calls, role changes, persisted state, or mutations.
 */

export type WorkloadTask = { owner_id: string | null; status: string };
export type SearchTask = { key: string; title: string };
export type SearchMember = { name: string; specialty?: string | null };
export type SearchRisk = { active: boolean; evidence: { title: string }; reason: string };

/** One pass through tasks, regardless of team size. Completed work is excluded. */
export function countOpenTasksByOwner(tasks: readonly WorkloadTask[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.status === "done" || !task.owner_id) continue;
    counts.set(task.owner_id, (counts.get(task.owner_id) ?? 0) + 1);
  }
  return counts;
}

/** Preserve existing case-insensitive search and 6/4/4 result caps. */
export function searchWorkspaceItems<
  T extends SearchTask,
  M extends SearchMember,
  R extends SearchRisk
>(tasks: readonly T[], members: readonly M[], risks: readonly R[], query: string) {
  const needle = query.trim().toLowerCase();
  return {
    tasks: tasks.filter(t => (t.key + " " + t.title).toLowerCase().includes(needle)).slice(0, 6),
    people: members.filter(m => (m.name + " " + (m.specialty ?? "")).toLowerCase().includes(needle)).slice(0, 4),
    signals: risks.filter(r => r.active && (r.evidence.title + " " + r.reason).toLowerCase().includes(needle)).slice(0, 4),
  };
}
