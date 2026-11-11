import { describe, expect, it } from "vitest";
import { dueState, sortTasksByAttention } from "./task-attention";

const now = new Date("2026-11-11T12:00:00Z");
const task = (id: string, priority: string, due: string | null) => ({ id, key: id, status: "todo", priority, due_at: due });

describe("task attention", () => {
  it("does not call completed tasks overdue", () => {
    expect(dueState("2026-11-10T00:00:00Z", "done", now)).toBe("complete");
    expect(dueState("2026-11-10T00:00:00Z", "todo", now)).toBe("overdue");
  });
  it("distinguishes upcoming, unscheduled and invalid dates", () => {
    expect(dueState("2026-11-12T06:00:00Z", "todo", now)).toBe("soon");
    expect(dueState("2026-12-12T06:00:00Z", "todo", now)).toBe("scheduled");
    expect(dueState(null, "todo", now)).toBe("unscheduled");
    expect(dueState("not-a-date", "todo", now)).toBe("unscheduled");
  });
  it("puts overdue and blocked work ahead of upcoming low-priority work", () => {
    const tasks = [task("later", "normal", null), task("urgent", "high", "2026-11-10T12:00:00Z"), { ...task("blocked", "normal", null), status: "blocked" }];
    expect(sortTasksByAttention(tasks, now).map(t => t.id)).toEqual(["blocked", "urgent", "later"]);
  });
  it("does not mutate the original task list", () => {
    const tasks = [task("b", "normal", null), task("a", "critical", null)];
    expect(sortTasksByAttention(tasks, now).map(t => t.id)).toEqual(["a", "b"]);
    expect(tasks[0].id).toBe("b");
  });
});
