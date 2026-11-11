import { validateGraph, type Edge } from "./graph";

export function dependencyFeedback(ids: string[], edges: Edge[], predecessor: string, successor: string): string | null {
  if (!ids.includes(predecessor) || !ids.includes(successor)) return "Select two available tasks.";
  if (predecessor === successor) return "Choose two different tasks to connect.";
  if (edges.some(e => e.predecessor_id === predecessor && e.successor_id === successor)) return "These tasks are already linked.";
  try {
    validateGraph(ids, [...edges, { predecessor_id: predecessor, successor_id: successor }]);
  } catch (cause) {
    return (cause as Error).message;
  }
  return null;
}
