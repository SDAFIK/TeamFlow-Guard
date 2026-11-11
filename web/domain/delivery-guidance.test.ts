import { describe, expect, it } from "vitest";
import { getDeliveryFocus, getDeliveryProgress } from "./delivery-guidance";

const base = { role: "lead" as const, tasks: 4, connections: 2, activeRisks: 0, pendingDecisions: 0 };

describe("delivery focus", () => {
  it("prioritizes an actionable human decision above an existing risk", () => {
    expect(getDeliveryFocus({ ...base, activeRisks: 2, pendingDecisions: 1 }).kind).toBe("decision");
  });
  it("sends the team to a risk when no review is waiting", () => {
    expect(getDeliveryFocus({ ...base, activeRisks: 1 }).kind).toBe("risk");
  });
  it("offers a first task to a lead, but not to a viewer", () => {
    expect(getDeliveryFocus({ ...base, tasks: 0 }).kind).toBe("create-task");
    expect(getDeliveryFocus({ ...base, tasks: 0, role: "viewer" }).kind).toBe("view-tasks");
  });
  it("guides teams from a second task to a dependency", () => {
    expect(getDeliveryFocus({ ...base, tasks: 1 }).kind).toBe("create-task");
    expect(getDeliveryFocus({ ...base, connections: 0 }).kind).toBe("connect-tasks");
  });
  it("never asks viewers to write dependencies", () => {
    expect(getDeliveryFocus({ ...base, connections: 0, role: "viewer" }).kind).toBe("view-dependencies");
  });
  it("offers monitoring when setup and approvals are clear", () => {
    expect(getDeliveryFocus(base).kind).toBe("monitor");
  });
});

describe("delivery progress", () => {
  it("shows actual completion and no invented baseline", () => {
    expect(getDeliveryProgress({ total: 0, done: 0 })).toEqual({ percentage: 0, caption: "Add a task to begin tracking progress" });
    expect(getDeliveryProgress({ total: 4, done: 1 })).toEqual({ percentage: 25, caption: "1 of 4 tasks completed" });
  });
});
