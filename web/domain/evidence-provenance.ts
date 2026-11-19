/** Display only the provenance actually recorded for each risk signal. */
export function evidenceOriginLabel(origin: string): string {
  switch (origin) {
    case "seed": return "Fictional seeded evidence";
    case "replay": return "Fictional replay event";
    case "manual": return "Team-reported signal";
    case "github": return "GitHub-sourced event";
    default: return "Project evidence (source unspecified)";
  }
}

export function evidenceOriginDescription(origin: string): string {
  switch (origin) {
    case "seed": return "This evidence belongs to an explicitly fictional example, not a live external event.";
    case "replay": return "This event was replayed for demonstration, not received from GitHub.";
    case "manual": return "A teammate reported this signal. It is not independently verified by an external integration.";
    case "github": return "This record was attributed to the connected GitHub evidence integration.";
    default: return "The evidence record does not identify a verified origin.";
  }
}
