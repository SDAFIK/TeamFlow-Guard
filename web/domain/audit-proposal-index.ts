import type { Audit, Proposal } from "@/lib/api";

export type AuditEvent = Pick<Audit, "kind" | "plan_version" | "summary" | "changes">;
export type ProposalCandidate = Pick<Proposal, "status" | "base_plan_version" | "title" | "actions">;

function indexKey(planVersion: number, title: string, actionCount: number): string {
  return JSON.stringify([planVersion, title, actionCount]);
}

/**
 * Group approved proposals once instead of scanning every proposal for each audit event.
 * Preserve the original exact before/after comparison and reject ambiguous matches.
 */
export function indexApprovedProposals<T extends ProposalCandidate>(proposals: readonly T[]): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const proposal of proposals) {
    if (proposal.status !== "approved") continue;
    const key = indexKey(proposal.base_plan_version + 1, proposal.title, proposal.actions.length);
    const bucket = index.get(key);
    if (bucket) bucket.push(proposal);
    else index.set(key, [proposal]);
  }
  return index;
}

export function findApprovedProposal<T extends ProposalCandidate>(
  event: AuditEvent,
  index: ReadonlyMap<string, readonly T[]>,
): T | null {
  if (event.kind !== "proposal.approved") return null;
  const candidates = index.get(indexKey(event.plan_version, event.summary, event.changes.length)) ?? [];
  let matched: T | null = null;
  for (const proposal of candidates) {
    const sameChanges = proposal.actions.every((action, i) => {
      const change = event.changes[i];
      return action.task_id === change.task_id &&
        action.field === change.field &&
        action.before === change.before &&
        action.after === change.after;
    });
    if (!sameChanges) continue;
    if (matched) return null;
    matched = proposal;
  }
  return matched;
}
