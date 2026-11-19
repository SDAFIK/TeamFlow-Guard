import { describe, expect, it } from "vitest";
import { countOpenTasksByOwner, searchWorkspaceItems } from "./dashboard-efficiency";

describe("dashboard workload accounting", () => {
  it("counts unfinished assigned tasks in one pass and ignores done or unassigned work", () => {
    const counts = countOpenTasksByOwner([
      { owner_id: "a", status: "todo" },
      { owner_id: "b", status: "blocked" },
      { owner_id: "a", status: "in_progress" },
      { owner_id: "a", status: "done" },
      { owner_id: null, status: "todo" },
    ]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.has("")).toBe(false);
  });

  it("handles no active tasks and never mutates source tasks", () => {
    const tasks = Object.freeze([{ owner_id: "a", status: "done" }]);
    expect(countOpenTasksByOwner(tasks).size).toBe(0);
    expect(tasks).toHaveLength(1);
  });
});

describe("workspace search selectors", () => {
  const tasks = Array.from({ length: 9 }, (_, i) => ({ key: "APP-" + i, title: "Launch Feature " + i }));
  const members = Array.from({ length: 6 }, (_, i) => ({ name: "Teammate " + i, specialty: "Design" }));
  const risks = [
    ...Array.from({ length: 7 }, (_, i) => ({ active: true, evidence: { title: "CI Failure " + i }, reason: "Build regression" })),
    { active: false, evidence: { title: "CI Failure retired" }, reason: "Already resolved" },
  ];

  it("preserves the existing result caps and excludes inactive risk evidence", () => {
    const result = searchWorkspaceItems(tasks, members, risks, "");
    expect(result.tasks).toHaveLength(6);
    expect(result.people).toHaveLength(4);
    expect(result.signals).toHaveLength(4);
    expect(result.signals.some(r => !r.active)).toBe(false);
  });

  it("matches task keys, titles, people, specialties, and risk reasons case-insensitively", () => {
    expect(searchWorkspaceItems(tasks, members, risks, " app-4 ").tasks[0].key).toBe("APP-4");
    expect(searchWorkspaceItems(tasks, members, risks, "feature 7").tasks[0].key).toBe("APP-7");
    expect(searchWorkspaceItems(tasks, members, risks, " DESIGN ").people).toHaveLength(4);
    expect(searchWorkspaceItems(tasks, members, risks, "build regression").signals).toHaveLength(4);
    expect(searchWorkspaceItems(tasks, members, risks, "retired").signals).toHaveLength(0);
  });

  it("returns no matches for missing terms and leaves source arrays intact", () => {
    expect(searchWorkspaceItems(tasks, members, risks, "not in this workspace")).toEqual({
      tasks: [], people: [], signals: [],
    });
    expect(tasks).toHaveLength(9);
    expect(members).toHaveLength(6);
    expect(risks).toHaveLength(8);
  });
});
