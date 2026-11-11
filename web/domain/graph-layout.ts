import type { Edge } from "./graph";

type Positioned = { x: number; y: number; depth: number };
type Item = { id: string; key: string };

/** Stable, left-to-right DAG layout. Never infer dependency direction from array order. */
export function layoutDependencyGraph<T extends Item>(tasks: T[], edges: Edge[]): {
  positions: Record<string, Positioned>;
  invalid: boolean;
} {
  const byId = new Map(tasks.map(task => [task.id, task]));
  const ids = [...byId.keys()].sort((a, b) =>
    byId.get(a)!.key.localeCompare(byId.get(b)!.key) || a.localeCompare(b),
  );
  const incoming = new Map(ids.map(id => [id, new Set<string>()]));
  const outgoing = new Map(ids.map(id => [id, new Set<string>()]));
  let invalid = byId.size !== tasks.length;

  for (const edge of edges) {
    if (!byId.has(edge.predecessor_id) || !byId.has(edge.successor_id) || edge.predecessor_id === edge.successor_id) {
      invalid = true;
      continue;
    }
    incoming.get(edge.successor_id)!.add(edge.predecessor_id);
    outgoing.get(edge.predecessor_id)!.add(edge.successor_id);
  }

  const indegree = new Map(ids.map(id => [id, incoming.get(id)!.size]));
  const depth = new Map(ids.map(id => [id, 0]));
  const queue = ids.filter(id => indegree.get(id) === 0);
  const visited: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    visited.push(id);
    for (const next of outgoing.get(id)!) {
      depth.set(next, Math.max(depth.get(next)!, depth.get(id)! + 1));
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
    queue.sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
  }

  if (visited.length !== ids.length) {
    invalid = true;
    // Still render every task as a readable list if historical data contains a cycle.
    for (const id of ids) depth.set(id, 0);
  }

  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const column = depth.get(id)!;
    columns.set(column, [...(columns.get(column) ?? []), id]);
  }
  const order = new Map<string, number>();
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const entries = columns.get(column)!;
    entries.sort((a, b) => {
      const average = (id: string) => {
        const parents = [...incoming.get(id)!].filter(p => order.has(p));
        return parents.length ? parents.reduce((total, p) => total + order.get(p)!, 0) / parents.length : Infinity;
      };
      return average(a) - average(b) || byId.get(a)!.key.localeCompare(byId.get(b)!.key);
    });
    entries.forEach((id, index) => order.set(id, index));
  }

  const maxRows = Math.max(1, ...[...columns.values()].map(col => col.length));
  const positions: Record<string, Positioned> = {};
  for (const [column, entries] of columns) {
    const offset = ((maxRows - entries.length) * 142) / 2;
    entries.forEach((id, index) => {
      positions[id] = { x: column * 302, y: offset + index * 142, depth: column };
    });
  }
  return { positions, invalid };
}
