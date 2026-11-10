import { z } from "zod";
import type { Client } from "./state";
import { databaseError, HttpError } from "./state";
import type { Audit } from "@/lib/api";

const cursorSchema = z.object({ at: z.iso.datetime({ offset: true }), id: z.uuid() }).strict();
export async function auditPage(client: Client, workspace: string, user: string, params: URLSearchParams) {
  const limit = z.coerce.number().int().min(1).max(100).parse(params.get("limit") ?? 25);
  let cursor: z.infer<typeof cursorSchema> | null = null;
  if (params.has("cursor")) {
    const raw = params.get("cursor")!;
    if (raw.length > 250) throw new HttpError(422, "Invalid history cursor");
    try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))); }
    catch { throw new HttpError(422, "Invalid history cursor"); }
  }
  const membership = await client.from("tf_memberships").select("user_id").eq("workspace_id", workspace).eq("user_id", user).maybeSingle();
  if (membership.error) databaseError(membership.error);
  if (!membership.data) throw new HttpError(404, "Workspace is unavailable");
  let query = client.from("tf_audit").select("id,actor_name,kind,summary,created_at,plan_version,changes,proposal_id").eq("workspace_id", workspace).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  // Validated timestamp + UUID only; preserve database timestamp precision and tie-break equal times.
  if (cursor) query = query.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`);
  const result = await query;
  if (result.error) databaseError(result.error);
  const rows = (result.data ?? []) as Audit[];
  const items = rows.slice(0, limit), last = items.at(-1);
  return { items, next_cursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ at: last.created_at, id: last.id })).toString("base64url") : null };
}
