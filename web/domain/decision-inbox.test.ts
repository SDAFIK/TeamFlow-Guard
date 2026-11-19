import { describe, expect, it } from "vitest";
import { decisionCounts, matchesDecisionFilter, type DecisionItem } from "./decision-inbox";

const proposals: DecisionItem[] = [
  { status: "pending", stale: false },
  { status: "pending", stale: true },
  { status: "approved", stale: false },
  { status: "rejected", stale: false },
];

describe("decision inbox filters", () => {
  it("distinguishes actionable pending proposals from stale pending ones", () => {
    expect(proposals.filter(p => matchesDecisionFilter(p, "ready"))).toEqual([proposals[0]]);
    expect(proposals.filter(p => matchesDecisionFilter(p, "stale"))).toEqual([proposals[1]]);
    expect(proposals.filter(p => matchesDecisionFilter(p, "pending"))).toHaveLength(2);
  });
  it("preserves status filtering and all proposals", () => {
    expect(proposals.filter(p => matchesDecisionFilter(p, "approved"))).toEqual([proposals[2]]);
    expect(proposals.filter(p => matchesDecisionFilter(p, "rejected"))).toEqual([proposals[3]]);
    expect(proposals.filter(p => matchesDecisionFilter(p, "all"))).toHaveLength(4);
  });
  it("counts only pending proposals as ready or stale", () => {
    expect(decisionCounts([...proposals, {status:"approved",stale:true}])).toEqual({
      all: 5, ready: 1, stale: 1, pending: 2, approved: 2, rejected: 1,
    });
  });
  it("handles empty inbox safely", () => {
    expect(decisionCounts([])).toEqual({
      all: 0, ready: 0, stale: 0, pending: 0, approved: 0, rejected: 0,
    });
  });
});
