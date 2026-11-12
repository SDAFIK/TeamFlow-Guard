import "server-only";
import { createHash } from "node:crypto";
import { risksFor } from "@/domain/risk-engine";
import { type Client, type State, mutate, snapshot, HttpError, databaseError } from "./state";
import { PROMPT_VERSION } from "./gemini";
import { generateRecovery } from "./recovery-provider";
import { buildRecoveryOptions, githubReviewReviewer } from "@/domain/recovery-options";
export async function recovery(client: Client, state: State, riskId: string, mode: string, key: string, strategy?: string) {
  if (state.role === "viewer") throw new HttpError(403, "Viewers cannot generate proposals.");
  const risk = risksFor(state.tasks, state.edges, state.evidence, state.members, state.workspace.review_threshold_hours, new Date(), state.workspace.tracked_branch).find(r => r.id === riskId);
  if (!risk?.active || risk.stale_evidence) throw new HttpError(409, "Risk evidence is resolved or stale. Refresh the source first.");
  const task = state.tasks.find(t => t.id === risk.evidence.task_id)!;
  const observedReviewer=githubReviewReviewer(risk.evidence);
  const alternatives = buildRecoveryOptions(state.tasks, state.edges, state.members, task.id, risk.evidence.kind,Date.now(),observedReviewer);
  const selected = strategy ? alternatives.find(option => option.id === strategy) : undefined;
  if (strategy && !selected) throw new HttpError(409, "This option is no longer available. Refresh the recovery choices.");
  const options = selected?.actions ?? alternatives.flatMap(option => option.actions);
  if (!options.length) throw new HttpError(422, "No feasible change found. Review the plan manually.");
  const context = { risk: risk.reason, risk_kind:risk.evidence.kind, affected_task_ids:risk.affected_task_ids, ...(observedReviewer?{github_review:{reviewer_id:observedReviewer,requested_at:risk.evidence.payload.review_requested_at,source_url:risk.evidence.payload.source_url,plan_only:true}}:{}), task: { id: task.id, key: task.key, title: task.title }, evidence: [{ id: risk.evidence.id, origin: risk.evidence.origin, title: risk.evidence.title, detail: risk.evidence.detail.slice(0, 1500), observed_at: risk.evidence.observed_at }], candidates: options };
  let body = { title: selected?.title ?? `Recovery plan for ${task.key}`, explanation: selected ? `${risk.reason} ${selected.effect}` : risk.reason, source: "rules", base_plan_version: state.workspace.plan_version, actions: options, evidence_ids: [riskId], risk_id: riskId, assumptions: ["Rule-based suggestion; no AI request was made.", "Plan changes do not repair CI or guarantee delivery dates.", ...(selected ? [selected.tradeoff] : alternatives.map(option => option.tradeoff))] };
  let runId: string | undefined;
  if (mode === "gemini") {
    if (key.length < 8) throw new HttpError(422, "A generation idempotency key is required.");
    const fingerprint = createHash("sha256").update(JSON.stringify({ context, version: state.workspace.plan_version, prompt: PROMPT_VERSION })).digest("hex");
    const reservation = await client.rpc("tf_analysis_begin", { w: state.workspace.id, request_key: key, fingerprint, model: process.env.GEMINI_MODEL ?? "unconfigured", prompt_version: PROMPT_VERSION });
    if (reservation.error) databaseError(reservation.error);
    const run = reservation.data as { id: string; status: string; proposal_id: string | null; existing: boolean };
    if (run.existing) {
      if (run.proposal_id) return state.proposals.find(p => p.id === run.proposal_id) ?? (await snapshot(client, state.workspace.id)).proposals.find(p => p.id === run.proposal_id);
      throw new HttpError(409, "This analysis was already requested. Refresh or start a new request.");
    }
    runId = run.id;
    try {
      const result = await generateRecovery("gemini", context, [riskId], options.length);
      if (!result.candidate.action_indices.length) throw new HttpError(422, "Gemini found no supported recovery action. Review the evidence manually.");
      body = { ...body, title: result.candidate.title, explanation: result.candidate.explanation, source: "gemini", actions: result.candidate.action_indices.map(i => options[i]), assumptions: observedReviewer?[...result.candidate.assumptions.slice(0,4),"Approval changes only TeamFlow; any GitHub review request must be made separately."]:result.candidate.assumptions };
      const saved = await client.rpc("tf_analysis_finish", { w: state.workspace.id, run_id: runId, proposal: body, usage: result.usage, latency_ms: result.latency_ms });
      if (saved.error) databaseError(saved.error);
      return saved.data;
    } catch (error) {
      await client.rpc("tf_analysis_fail", { w: state.workspace.id, run_id: runId });
      throw error;
    }
  }
  return mutate(client, state.workspace.id, "proposal", body);
}
