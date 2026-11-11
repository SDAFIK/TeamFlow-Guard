import { describe, expect, it } from "vitest";
import { getSetupProgress } from "./onboarding";

describe("real workspace onboarding", () => {
  it("starts with a real task, not invented progress", () => {
    expect(getSetupProgress({ tasks: 0, members: 1, connections: 0 })).toMatchObject({
      completed: 0,
      next: "create-task",
      isComplete: false,
    });
  });

  it("guides owners from first task to teammate and connected work", () => {
    expect(getSetupProgress({ tasks: 1, members: 1, connections: 0 }).next).toBe("invite-team");
    expect(getSetupProgress({ tasks: 1, members: 2, connections: 0 }).next).toBe("add-task");
    expect(getSetupProgress({ tasks: 2, members: 2, connections: 0 }).next).toBe("connect-work");
  });

  it("marks milestones complete only when persisted counts show them", () => {
    expect(getSetupProgress({ tasks: 2, members: 2, connections: 1 })).toMatchObject({
      completed: 3,
      next: "explore-risks",
      isComplete: true,
    });
  });

  it("handles negative or missing-looking counts without false progress", () => {
    const result = getSetupProgress({ tasks: -1, members: 0, connections: -4 });
    expect(result.completed).toBe(0);
  });
});
