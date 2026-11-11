import { describe, expect, it } from "vitest";
import { dependencyFeedback } from "./dependency-feedback";

const tasks = ["a", "b", "c"];
const edges = [{ predecessor_id: "a", successor_id: "b" }, { predecessor_id: "b", successor_id: "c" }];

describe("dependency proposal guidance", () => {
  it("requires two different tasks", () => {
    expect(dependencyFeedback(tasks, edges, "a", "a")).toMatch(/different/);
  });
  it("shows an existing link", () => {
    expect(dependencyFeedback(tasks, edges, "a", "b")).toMatch(/already linked/);
  });
  it("explains a cycle before a server request", () => {
    expect(dependencyFeedback(tasks, edges, "c", "a")).toMatch(/cycle/);
  });
  it("allows a new valid connection", () => {
    expect(dependencyFeedback(tasks, [], "a", "c")).toBeNull();
  });
});
