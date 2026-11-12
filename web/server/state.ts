import "server-only";
import type { supabaseServer } from "./supabase";
import type { Overview, Task, Proposal, Audit } from "@/lib/api";
import type { EvidenceRecord, Availability } from "@/domain/risk-engine";
import type { Edge } from "@/domain/graph";
export type Client = Awaited<ReturnType<typeof supabaseServer>>;
export type State = {
  workspace: { id: string; name: string; description: string; is_demo: boolean; fixture_label: string; plan_version: number; review_threshold_hours: number; tracked_branch: string; github_repository: string | null };
  role: "owner" | "manager" | "member" | "viewer";
  members: (Overview["members"][number] & Availability)[];
  tasks: (Task & { due_at: string | null })[]; edges: Edge[]; evidence: EvidenceRecord[]; proposals: Proposal[]; audit: Audit[];
};
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function databaseError(error: { code?: string; message: string }) {
  const codes: Record<string, number> = { "42501": 403, "28000": 401, "40001": 409, "PT409": 409, "22023": 422, "23514": 422, "23503": 422, "22P02": 422, "23505": 409 };
  const status = error.code === "P0429" ? 429 : codes[error.code ?? ""] ?? 503;
  // Do not expose SQL, tenant records, connection details or constraint values.
  throw new HttpError(status, status === 403 ? "Your role does not permit this action, or the invitation is unavailable for this email." : status === 429 ? "Too many requests. Please try again later." : status === 409 ? "The plan or request changed. Refresh and try again." : status === 422 ? "The change failed validation. Check values, capacity and dependencies." : "Database unavailable. Please retry.");
}
export async function snapshot(client: Client, id: string): Promise<State> {
  const { data, error } = await client.rpc("tf_snapshot", { w: id });
  if (error) databaseError(error);
  if (!data) throw new HttpError(404, "Workspace is unavailable");
  return data as State;
}
export async function mutate(client: Client, id: string, operation: string, body: unknown, key = "") {
  const { data, error } = await client.rpc("tf_mutate", { w: id, operation, body, request_key: key });
  if (error) databaseError(error);
  return data;
}
export const uiRole = (role: string) => role === "owner" || role === "manager" ? "lead" : role === "viewer" ? "viewer" : "contributor";
