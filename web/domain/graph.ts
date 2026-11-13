export type Edge = { predecessor_id: string; successor_id: string };
export function downstream(ids: string[], edges: Edge[], selected: string, reverse = false): string[] {
  const known = new Set(ids);
  if (!known.has(selected)) throw new Error("Task is unavailable");
  const seen = new Set<string>();
  const queue = [selected];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      const [from, to] = reverse ? [edge.successor_id, edge.predecessor_id] : [edge.predecessor_id, edge.successor_id];
      if (!known.has(from) || !known.has(to)) throw new Error("Dependency is outside this workspace");
      if (from === current && !seen.has(to)) { seen.add(to); queue.push(to); }
    }
  }
  seen.delete(selected);
  return [...seen];
}
export function validateGraph(ids: string[], edges: Edge[]) {
  const remaining = new Map(ids.map(id => [id, 0]));
  const unique=new Set<string>();
  for (const e of edges) {
    const key=JSON.stringify([e.predecessor_id,e.successor_id]);
    if(unique.has(key))throw Error("This dependency already exists");
    unique.add(key);
    if (!remaining.has(e.predecessor_id) || !remaining.has(e.successor_id) || e.predecessor_id === e.successor_id) throw new Error("Invalid dependency");
    remaining.set(e.successor_id, remaining.get(e.successor_id)! + 1);
  }
  const ready = ids.filter(id => remaining.get(id) === 0);
  let count = 0;
  while (ready.length) {
    const id = ready.shift()!; count++;
    for (const e of edges.filter(e => e.predecessor_id === id)) {
      const value = remaining.get(e.successor_id)! - 1; remaining.set(e.successor_id, value);
      if (!value) ready.push(e.successor_id);
    }
  }
  if (count !== ids.length) throw new Error("Dependency would create a cycle");
}
