import { describe, expect, it } from "vitest";
import { suggestTaskKey } from "./task-key";

describe("new task key suggestions", () => {
  it("suggests a usable key for a new team", () => {
    expect(suggestTaskKey([])).toBe("TASK-001");
  });

  it("finds the next unused numbered key", () => {
    expect(suggestTaskKey(["TASK-001", "task-002", "CHK-318"])).toBe("TASK-003");
  });

  it("does not change the existing keys", () => {
    const keys = ["TASK-009", "TASK-003"];
    expect(suggestTaskKey(keys)).toBe("TASK-010");
    expect(keys).toEqual(["TASK-009", "TASK-003"]);
  });
});
