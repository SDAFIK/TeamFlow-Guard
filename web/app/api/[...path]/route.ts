import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/server/supabase";
import { snapshot, mutate, HttpError, databaseError, uiRole, type Client } from "@/server/state";
import { risksFor } from "@/domain/risk-engine";
import { downstream, validateGraph } from "@/domain/graph";
import { actionSchema } from "@/domain/proposal";
import { recovery } from "@/server/recovery";
import { configured } from "@/server/gemini";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function scopedWorkspace(client: Client, table: string, id: string) {
  const { data, error } = await client.from(table).select("workspace_id").eq("id", id).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new HttpError(404, "Record unavailable");
  return data.workspace_id as string;
}
async function readBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 32_768) { await reader.cancel(); throw new HttpError(413, "Request exceeds size limit"); }
    chunks.push(value);
  }
  if (length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(422, "Invalid JSON request"); }
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  // Explicit opt-in preserves the existing local app until Supabase is configured.
  if (process.env.TEAMFLOW_BACKEND !== "supabase") {
    if (process.env.VERCEL) return NextResponse.json({ message: "Supabase deployment is not configured." }, { status: 503 });
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`, { method: request.method, headers: request.headers, body: ["GET","HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(), redirect: "manual" });
      return new NextResponse(response.body, { status: response.status, headers: response.headers });
    } catch { return NextResponse.json({ message: "Local API unavailable. Please retry." }, { status: 503 }); }
  }
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      const allowed = process.env.APP_BASE_URL ?? "http://localhost:3000";
      if (request.headers.get("origin") !== allowed) throw new HttpError(403, "Request origin is not allowed");
    }
    if (path.join("/") === "health") return answer({ message: "alive" });
    const client = await supabaseServer();
    const body = ["GET", "HEAD"].includes(request.method) ? {} : await readBody(request);
    if (path.join("/") === "auth/login" && request.method === "POST") {
      const input = z.object({ email: z.email().max(254), password: z.string().min(1).max(256) }).strict().parse(body);
      const { data, error } = await client.auth.signInWithPassword(input);
      if (error) throw new HttpError(error.status === 429 ? 429 : 401, error.status === 429 ? "Too many attempts. Try again later." : "Email or password is incorrect");
      return answer({ id: data.user.id, email: data.user.email ?? "", name: data.user.email?.split("@")[0] ?? "Member" });
    }
    if (path.join("/") === "auth/logout" && request.method === "POST") {
      const { error } = await client.auth.signOut(); if (error) throw new HttpError(503, "Sign out failed. Retry.");
      return answer({ message: "Signed out" });
    }
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new HttpError(401, "Sign in to continue");
    if (path[0] === "me" && path.length === 1 && request.method === "GET") {
      const { data } = await client.from("tf_memberships").select("name").eq("user_id", user.id).limit(1).maybeSingle();
      return answer({ id: user.id, email: user.email ?? "", name: data?.name ?? "Member" });
    }
    if (path[0] === "projects" && path.length === 1 && request.method === "GET") {
      const { data, error } = await client.from("tf_memberships").select("workspace_id,role,tf_workspaces(name)").eq("user_id", user.id);
      if (error) databaseError(error);
      return answer((data ?? []).map(row => ({ id: row.workspace_id, role: uiRole(row.role), name: (row.tf_workspaces as unknown as { name: string }).name })));
    }
    if (path[0] === "projects" && path.length >= 2) {
      const id = z.uuid().parse(path[1]); const state = await snapshot(client, id);
      const risks = () => risksFor(state.tasks, state.edges, state.evidence, state.members, state.workspace.review_threshold_hours);
      if (request.method === "GET") {
        const selected = request.nextUrl.searchParams.get("selected");
        switch (path[2]) {
          case "dashboard": return answer({ project: { id, name: state.workspace.name, role: uiRole(state.role) }, description: state.workspace.description, is_demo: state.workspace.is_demo, fixture_label: state.workspace.fixture_label, plan_version: state.workspace.plan_version, as_of: new Date().toISOString(), tasks: state.tasks, members: state.members.map(m => ({ ...m, role: uiRole(m.role) })), counts: { total: state.tasks.length, ...Object.fromEntries(["todo","in_progress","blocked","done"].map(s => [s, state.tasks.filter(t => t.status === s).length])) } });
          case "tasks": return answer(state.tasks);
          case "dependencies": return answer({ nodes: state.tasks, edges: state.edges, plan_version: state.workspace.plan_version, selected_task_id: selected, downstream_ids: selected ? downstream(state.tasks.map(t => t.id), state.edges, selected) : [], upstream_ids: selected ? downstream(state.tasks.map(t => t.id), state.edges, selected, true) : [] });
          case "risks": return answer(risks());
          case "proposals": return answer(state.proposals);
          case "audit": return answer(state.audit);
          case "integrations": return answer({ ai_configured: configured(), ai_provider: "gemini", ai_model: process.env.GEMINI_MODEL ?? null, github_configured: false, mode: state.workspace.is_demo ? "demo" : "manual" });
          case "settings": if (!["owner","manager"].includes(state.role)) throw new HttpError(403, "Manager access required"); return answer(state.workspace);
        }
      }
      if (path[2] === "dependencies" && path[3] === "validate" && request.method === "POST") {
        const edge = z.object({ predecessor_id: z.uuid(), successor_id: z.uuid() }).strict().parse(body);
        try { validateGraph(state.tasks.map(t => t.id), [...state.edges, edge]); } catch (e) { throw new HttpError(422, (e as Error).message); }
        return answer({ message: "Dependency is valid. Submit a proposal to apply it." });
      }
      if (path[2] === "proposals" && request.method === "POST") {
        const input = z.object({ title: z.string().min(3).max(140), base_plan_version: z.number().int().positive(), actions: z.array(actionSchema).min(1).max(8) }).strict().parse(body);
        return answer(await mutate(client, id, "proposal", { ...input, explanation: "Human-authored change; review current constraints before approval.", source: "manual", evidence_ids: [], assumptions: ["This is a human-authored proposal, not AI analysis."] }));
      }
      if (path[2] === "tasks" && request.method === "POST") {
        const input = z.object({ key: z.string().regex(/^[A-Z][A-Z0-9-]{2,29}$/), title: z.string().min(1).max(140), description: z.string().max(1500).default(""), owner_id: z.uuid(), estimate_hours: z.number().int().min(1).max(160), due_at: z.iso.datetime().nullable(), base_plan_version: z.number().int().positive() }).strict().parse(body);
        const result = await client.rpc("tf_task_write", { w:id, operation:"create", body:input }); if(result.error) databaseError(result.error); return answer(result.data);
      }
      if (path[2] === "demo-events" && request.method === "POST") {
        const input = z.object({ kind: z.enum(["ci_failure","ci_pass","review_delay","capacity","dependency"]), task_id: z.uuid(), event_key: z.string().min(8).max(100) }).strict().parse(body);
        await mutate(client, id, "replay", input);
        const fresh = await snapshot(client, id);
        return answer(risksFor(fresh.tasks, fresh.edges, fresh.evidence, fresh.members, fresh.workspace.review_threshold_hours));
      }
      if (path[2] === "availability" && request.method === "PUT") {
        const input = z.object({ hours: z.number().int().min(0).max(80), start_at: z.iso.datetime().optional(), end_at: z.iso.datetime().optional() }).strict().parse(body);
        return answer(await mutate(client, id, "availability", { ...input, start_at: input.start_at ?? new Date().toISOString(), end_at: input.end_at ?? new Date(Date.now() + 2 * 86400000).toISOString() }));
      }
    }
    if (path[0] === "tasks" && path.length === 2 && request.method === "PATCH") {
      const taskId = z.uuid().parse(path[1]);
      const input = z.object({ status: z.enum(["todo","in_progress","blocked","done"]), expected_version: z.number().int().positive(), note: z.string().max(500).default("") }).strict().parse(body);
      return answer(await mutate(client, await scopedWorkspace(client, "tf_tasks", taskId), "status", { ...input, task_id: taskId }));
    }
    if (path[0] === "tasks" && ["edit","archive"].includes(path[2]) && request.method === "POST") {
      const taskId = z.uuid().parse(path[1]);
      const input = z.object({ title:z.string().min(1).max(140).optional(), description:z.string().max(1500).optional(), expected_version:z.number().int().positive(), base_plan_version:z.number().int().positive() }).strict().parse(body);
      if(path[2] === "edit" && !input.title) throw new HttpError(422,"Title is required");
      const result=await client.rpc("tf_task_write",{w:await scopedWorkspace(client,"tf_tasks",taskId),operation:path[2],body:{...input,task_id:taskId}});if(result.error) databaseError(result.error);return answer(result.data);
    }
    if (path[0] === "risks" && path[2] === "analyze" && request.method === "POST") {
      const riskId = z.uuid().parse(path[1]); const id = await scopedWorkspace(client, "tf_evidence", riskId);
      const mode = request.nextUrl.searchParams.get("mode") ?? "gemini";
      if (!["gemini","rules"].includes(mode)) throw new HttpError(422, "Unknown analysis mode");
      return answer(await recovery(client, await snapshot(client, id), riskId, mode, request.headers.get("Idempotency-Key") ?? ""));
    }
    if (path[0] === "proposals" && path[2] === "decision" && request.method === "POST") {
      const proposalId = z.uuid().parse(path[1]);
      const input = z.object({ decision: z.enum(["approve","reject"]), base_plan_version: z.number().int().positive() }).strict().parse(body);
      const key = z.string().min(8).max(120).parse(request.headers.get("Idempotency-Key"));
      return answer(await mutate(client, await scopedWorkspace(client, "tf_proposals", proposalId), "decision", { ...input, proposal_id: proposalId }, key));
    }
    throw new HttpError(404, "Endpoint unavailable");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 422 : 503;
    const message = error instanceof HttpError ? error.message : error instanceof z.ZodError ? "Invalid request fields" : (error as Error).message === "SUPABASE_NOT_CONFIGURED" ? "Supabase is not configured on the server." : "Service unavailable. Please retry.";
    return answer({ message, code: `HTTP_${status}`, request_id: crypto.randomUUID() }, status);
  }
}
function answer(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" } });
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
