/** Suggests an editable task key; final uniqueness is still enforced by the server. */
export function suggestTaskKey(existing: readonly string[]): string {
  const occupied = new Set(existing.map((key) => key.toUpperCase()));
  let next = 1;
  for (const key of occupied) {
    const match = /^TASK-(\d+)$/.exec(key);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  let candidate = `TASK-${String(next).padStart(3, "0")}`;
  while (occupied.has(candidate)) {
    next += 1;
    candidate = `TASK-${String(next).padStart(3, "0")}`;
  }
  return candidate;
}
