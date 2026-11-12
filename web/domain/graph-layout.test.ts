import { describe, expect, it } from "vitest";
import { layoutDependencyGraph } from "./graph-layout";

const tasks = [
  { id: "release", key: "REL-4" }, { id: "design", key: "REL-1" },
  { id: "qa", key: "REL-3" }, { id: "build", key: "REL-2" },
  { id: "other", key: "REL-5" },
];
const edges = [
  { predecessor_id: "design", successor_id: "build" },
  { predecessor_id: "build", successor_id: "qa" },
  { predecessor_id: "qa", successor_id: "release" },
  { predecessor_id: "design", successor_id: "qa" },
];

describe("dependency layout", () => {
  it("places every dependency after its predecessor regardless of source order", () => {
    const result = layoutDependencyGraph(tasks, edges);
    expect(result.invalid).toBe(false);
    for (const edge of edges) {
      expect(result.positions[edge.successor_id].x).toBeGreaterThan(result.positions[edge.predecessor_id].x);
    }
    expect(Object.keys(result.positions)).toHaveLength(tasks.length);
  });

  it("does not overlap independent tasks and stays stable when input order changes", () => {
    const a = layoutDependencyGraph(tasks, edges);
    const b = layoutDependencyGraph([...tasks].reverse(), [...edges].reverse());
    expect(a).toEqual(b);
    const unique = new Set(Object.values(a.positions).map(({ x, y }) => `${x},${y}`));
    expect(unique.size).toBe(tasks.length);
  });

  it("flags broken or cyclic links without hiding tasks", () => {
    const cyclic = layoutDependencyGraph(tasks, [...edges, { predecessor_id: "release", successor_id: "design" }]);
    expect(cyclic.invalid).toBe(true);
    expect(Object.keys(cyclic.positions)).toHaveLength(tasks.length);
    expect(layoutDependencyGraph(tasks, [{ predecessor_id: "missing", successor_id: "qa" }]).invalid).toBe(true);
  });
});
