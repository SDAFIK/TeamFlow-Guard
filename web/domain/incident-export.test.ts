import { describe, expect, it } from "vitest";
import type { Proposal, Risk, Task } from "../lib/api";
import { buildIncidentCsv, incidentRows } from "./incident-export";

const task = {
  id: "task-1", key: "AUTH-142", title: "Authentication", description: "",
  status: "blocked", owner_id: "owner-1", position: 1, version: 2,
  reviewer_id: null, priority: "high", estimate_hours: 8, due_at: null,
} satisfies Task;
const downstream = { ...task, id: "task-2", key: "CHECKOUT-4", status: "todo" } satisfies Task;
const risk = {
  id: "risk-1", severity: "high", reason: 'Blocked "checkout"\nwork',
  active: true, affected_task_ids: ["task-2", "task-2"],
  stale_evidence: false,
  evidence: {
    id: "evidence-1", task_id: "task-1", kind: "ci_failure",
    title: "=HYPERLINK(\"https://phishing.invalid\",\"click\")",
    detail: "private webhook payload must never appear", origin: "replay",
    active: true, observed_at: "2026-11-20T10:00:00Z",
  },
} satisfies Risk;
const proposal = {
  id: "proposal-1", title: "Reassign reviewer", explanation: "",
  source: "rules", base_plan_version: 3, actions: [],
  evidence_ids: ["evidence-1"], assumptions: [], status: "pending",
  stale: false, risk_id: "risk-1", created_at: "2026-11-20T10:10:00Z",
} satisfies Proposal;
const sample = {
  workspaceName: "Checkout Launch",
  planVersion: 3, snapshotAsOf: "2026-11-20T10:14:00Z",
  isDemo: true, tasks: [task, downstream], risks: [risk],
  proposals: [proposal], exportedAt: "2026-11-20T10:15:00Z",
};

describe("incident evidence export", () => {
  it("uses real task keys and proposal status without inventing an approval", () => {
    const rows = incidentRows(sample);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("FICTIONAL DEMO");
    expect(rows[0]).toContain("AUTH-142");
    expect(rows[0]).toContain("CHECKOUT-4");
    expect(rows[0]).toContain("rules:pending");
    expect(rows[0].filter(v => v === "CHECKOUT-4")).toHaveLength(1);
  });

  it("escapes formulas, quotes and newlines and excludes raw evidence details", () => {
    const csv = buildIncidentCsv(sample);
    expect(csv).toContain('"' + "'" + '=HYPERLINK(');
    expect(csv).toContain('Blocked ""checkout"" work');
    expect(csv).not.toContain("private webhook payload");
    expect(csv).toContain("FICTIONAL DEMO");
    expect(csv.split("\r\n")).toHaveLength(3); // header, one record, terminal line break
  });

  it("exports only supplied visible risks, not unrelated evidence or proposals", () => {
    const csv = buildIncidentCsv({
      ...sample, risks: [], proposals: [proposal], isDemo: false,
    });
    expect(csv).not.toContain("risk-1");
    expect(csv).not.toContain("rules:pending");
    expect(csv).toContain("risk_id");
  });

  it("marks stale evidence and resolved risk without implying CI was fixed", () => {
    const rows = incidentRows({
      ...sample, risks: [{ ...risk, active: false, stale_evidence: true }],
    });
    expect(rows[0]).toContain("resolved");
    expect(rows[0]).toContain("yes");
    expect(rows[0]).toContain("rules:pending");
  });
});
