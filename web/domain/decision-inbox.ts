/** Pure filters for the saved decision inbox; authorization still lives on the server. */
export type DecisionStatus = "pending" | "approved" | "rejected";
export type DecisionFilter = "all" | "ready" | "stale" | DecisionStatus;
export type DecisionItem = { status: string; stale: boolean };

export function matchesDecisionFilter(proposal: DecisionItem, filter: DecisionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "ready") return proposal.status === "pending" && !proposal.stale;
  if (filter === "stale") return proposal.status === "pending" && proposal.stale;
  return proposal.status === filter;
}

export function decisionCounts(items: readonly DecisionItem[]) {
  return {
    all: items.length,
    ready: items.filter(item => matchesDecisionFilter(item, "ready")).length,
    stale: items.filter(item => matchesDecisionFilter(item, "stale")).length,
    pending: items.filter(item => matchesDecisionFilter(item, "pending")).length,
    approved: items.filter(item => matchesDecisionFilter(item, "approved")).length,
    rejected: items.filter(item => matchesDecisionFilter(item, "rejected")).length,
  };
}
