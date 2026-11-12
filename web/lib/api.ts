import type { components } from "./api-schema";
export type Overview = components["schemas"]["Overview"];
export type Person = components["schemas"]["Person"];
export type Project = components["schemas"]["ProjectSummary"];
export type Task = components["schemas"]["TaskView"];
export type Graph = components["schemas"]["GraphView"];
export type Risk = components["schemas"]["RiskView"];
export type Proposal = components["schemas"]["ProposalView"];
export type Audit = components["schemas"]["AuditView"];
export type Integrations = components["schemas"]["IntegrationStatus"] & {
  github_repository?: string | null;
  github_evidence_imported?: boolean;
};
export type Action = components["schemas"]["Action"];
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.message ?? "Unable to reach the service. Please retry.",
    );
  }
  return res.json();
}
