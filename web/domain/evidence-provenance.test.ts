import { describe, expect, it } from "vitest";
import { evidenceOriginDescription, evidenceOriginLabel } from "./evidence-provenance";

describe("risk evidence provenance", () => {
  it("clearly identifies fictional seeded and replayed events", () => {
    expect(evidenceOriginLabel("seed")).toBe("Fictional seeded evidence");
    expect(evidenceOriginLabel("replay")).toBe("Fictional replay event");
    expect(evidenceOriginDescription("replay")).toContain("not received from GitHub");
  });

  it("does not present manually reported evidence as independently verified", () => {
    expect(evidenceOriginLabel("manual")).toBe("Team-reported signal");
    expect(evidenceOriginDescription("manual")).toContain("not independently verified");
  });

  it("labels GitHub attribution without claiming the delivery issue is repaired", () => {
    expect(evidenceOriginLabel("github")).toBe("GitHub-sourced event");
    expect(evidenceOriginDescription("github")).toContain("GitHub evidence integration");
  });

  it("handles unknown origins without inventing a source", () => {
    expect(evidenceOriginLabel("other")).toBe("Project evidence (source unspecified)");
    expect(evidenceOriginDescription("other")).toContain("does not identify");
  });
});
