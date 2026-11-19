import { describe, expect, it } from "vitest";
import { findApprovedProposal, indexApprovedProposals, type AuditEvent, type ProposalCandidate } from "./audit-proposal-index";

const change = { task_id: "task-a", field: "priority" as const, before: "normal", after: "high" };
const approved = (overrides: Partial<ProposalCandidate> = {}): ProposalCandidate => ({
  status: "approved",
  base_plan_version: 4,
  title: "Reassign review",
  actions: [{ ...change }],
  ...overrides,
});
const event = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  kind: "proposal.approved",
  plan_version: 5,
  summary: "Reassign review",
  changes: [{ ...change }],
  ...overrides,
});

describe("indexed audit proposal lookup", () => {
  it("matches one exact approved action and excludes other statuses", () => {
    const expected = approved();
    const index = indexApprovedProposals([approved({ status: "pending" }), expected, approved({ status: "rejected" })]);
    expect(findApprovedProposal(event(), index)).toBe(expected);
  });

  it("requires exact plan version, title and before/after changes", () => {
    const index = indexApprovedProposals([approved()]);
    expect(findApprovedProposal(event({ plan_version: 6 }), index)).toBeNull();
    expect(findApprovedProposal(event({ summary: "Different change" }), index)).toBeNull();
    expect(findApprovedProposal(event({ changes: [{ ...change, after: "critical" }] }), index)).toBeNull();
  });

  it("does not infer a proposal on ambiguous duplicate matches", () => {
    const index = indexApprovedProposals([approved(), approved()]);
    expect(findApprovedProposal(event(), index)).toBeNull();
  });

  it("does not attach a proposal to a non-approved audit event", () => {
    const index = indexApprovedProposals([approved()]);
    expect(findApprovedProposal(event({ kind: "task.updated" }), index)).toBeNull();
  });

  it("supports empty data without changing input collections", () => {
    const values = [approved()];
    const index = indexApprovedProposals(values);
    expect(findApprovedProposal(event(), index)).toBe(values[0]);
    expect(values).toHaveLength(1);
    expect(findApprovedProposal(event(), indexApprovedProposals([]))).toBeNull();
  });
});
