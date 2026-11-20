import type { Proposal, Risk, Task } from "../lib/api";

export type IncidentExportInput = {
  workspaceName: string;
  planVersion: number;
  snapshotAsOf: string;
  isDemo: boolean;
  risks: readonly Risk[];
  tasks: readonly Task[];
  proposals: readonly Proposal[];
  exportedAt: string;
};

// The report only uses already-authorized, workspace-scoped API responses.
// Avoid copying raw external webhook payloads, identities, credentials or source logs.
export const incidentHeaders = [
  "workspace",
  "data_scope",
  "plan_version",
  "snapshot_as_of",
  "exported_at",
  "risk_id",
  "evidence_id",
  "evidence_origin",
  "evidence_kind",
  "observed_at",
  "risk_status",
  "severity",
  "source_title",
  "source_task",
  "affected_tasks",
  "evidence_needs_refresh",
  "risk_reason",
  "linked_proposal_statuses",
] as const;

export function incidentRows(input: IncidentExportInput): string[][] {
  const taskKeys = new Map(input.tasks.map(task => [task.id, task.key]));
  return input.risks.map(risk => {
    const linked = input.proposals.filter(proposal =>
      proposal.risk_id === risk.id ||
      proposal.evidence_ids.includes(risk.evidence.id),
    );
    const statuses = [...new Set(linked.map(proposal =>
      (proposal.source || "unknown") + ":" + proposal.status +
      (proposal.stale ? " (stale)" : ""),
    ))];
    const affected = [...new Set(risk.affected_task_ids.map(id => taskKeys.get(id) ?? "[task unavailable]"))];
    return [
      input.workspaceName,
      input.isDemo ? "FICTIONAL DEMO" : "SAVED WORKSPACE",
      String(input.planVersion),
      input.snapshotAsOf,
      input.exportedAt,
      risk.id,
      risk.evidence.id,
      risk.evidence.origin,
      risk.evidence.kind,
      risk.evidence.observed_at,
      risk.active ? "active" : "resolved",
      risk.severity,
      risk.evidence.title,
      taskKeys.get(risk.evidence.task_id) ?? "[task unavailable]",
      affected.join("; "),
      risk.stale_evidence ? "yes" : "no",
      risk.reason,
      statuses.length ? statuses.join("; ") : "none",
    ];
  });
}

// Escape spreadsheet formulas as well as quotes, line breaks and separators.
// Treat every external title and explanation as untrusted text.
export function csvCell(value: string): string {
  const singleLine = value.replace(/[\u0000-\u001F\u007F]+/g, " ").trim();
  const safe = /^[=+\-@]/.test(singleLine) ? "'" + singleLine : singleLine;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function buildIncidentCsv(input: IncidentExportInput): string {
  const rows: readonly (readonly string[])[] = [incidentHeaders, ...incidentRows(input)];
  // BOM supports Unicode task titles in spreadsheet applications.
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
