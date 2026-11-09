import { z } from "zod";
export const actionSchema = z.object({
  task_id: z.uuid(), field: z.enum(["reviewer_id", "priority", "position", "dependency", "owner_id", "due_at"]),
  before: z.union([z.string(), z.number().int(), z.null()]), after: z.union([z.string(), z.number().int()]),
}).strict();
export const candidateSchema = z.object({
  title: z.string().min(3).max(140), explanation: z.string().min(1).max(1400),
  evidence_ids: z.array(z.uuid()).min(1).max(8), action_indices: z.array(z.number().int().nonnegative()).max(3),
  assumptions: z.array(z.string().min(1).max(300)).min(1).max(5),
  requires_human_approval: z.literal(true),
}).strict();
export function validateCandidate(value: unknown, evidenceIds: string[], candidateCount: number) {
  const parsed = candidateSchema.parse(value);
  if (parsed.evidence_ids.some(id => !evidenceIds.includes(id))) throw new Error("Unrecognized evidence citation");
  if (new Set(parsed.action_indices).size !== parsed.action_indices.length || parsed.action_indices.some(i => i >= candidateCount)) throw new Error("Unsupported action");
  return parsed;
}
export type ProposedAction = z.infer<typeof actionSchema>;
