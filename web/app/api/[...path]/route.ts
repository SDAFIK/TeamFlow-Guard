import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/server/supabase";
import { snapshot, mutate, HttpError, databaseError, uiRole, type Client } from "@/server/state";
import { risksFor } from "@/domain/risk-engine";
import { downstream, validateGraph } from "@/domain/graph";
import { actionSchema } from "@/domain/proposal";
import { recovery } from "@/server/recovery";
import { configured } from "@/server/gemini";
import { allowedOrigin } from "@/server/origin";
import { createHash, randomBytes } from "node:crypto";
import { auditPage } from "@/server/audit-page";
import { buildRecoveryOptions } from "@/domain/recovery-options";
import { recentPublicRuns, verifyPublicRepository } from "@/server/github-public";
import { githubAppConfig, bindingForWorkspace, githubAppReady, appRepositoryActivity } from "@/server/github-app";
import { invitationEmailConfigured, invitationURL, sendInvitationEmail, type InvitationEmailStatus } from "@/server/invitation-email";
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
      if (!allowedOrigin(request.headers.get("origin"), {
        APP_BASE_URL: process.env.APP_BASE_URL,
        APP_ALLOWED_ORIGINS: process.env.APP_ALLOWED_ORIGINS,
        VERCEL: process.env.VERCEL,
        VERCEL_URL: process.env.VERCEL_URL,
      })) throw new HttpError(403, "Request origin is not allowed");
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
    if (path.join('/') === 'auth/register' && request.method === 'POST') {
      const input=z.object({email:z.email().max(254),password:z.string().min(12).max(128)}).strict().parse(body);
      const {error}=await client.auth.signUp({...input,options:{emailRedirectTo:`${process.env.APP_BASE_URL}/auth/callback`}});
      if(error) throw new HttpError(error.status===429?429:422,'Account registration is unavailable. Check your email and password, or ask the workspace owner for access.');
      return answer({message:'Check your email to confirm your account, then return here to sign in.'});
    }
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new HttpError(401, "Sign in to continue");
    const inviteEmailConfig = { RESEND_API_KEY: process.env.RESEND_API_KEY, TEAMFLOW_INVITE_EMAIL_FROM: process.env.TEAMFLOW_INVITE_EMAIL_FROM, APP_BASE_URL: process.env.APP_BASE_URL };
    const workspaceWrite=async(w:string|null,operation:string,input:unknown)=>{
      const result=await client.rpc('tf_workspace_write',{w,operation,body:input});
      if(result.error) databaseError(result.error);return result.data;
    };
    if(path.join('/')==='projects' && request.method==='POST') {
      const input=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(1000).default(''),display_name:z.string().trim().min(1).max(80)}).strict().parse(body);
      return answer(await workspaceWrite(null,'create',input));
    }
    if(path.join('/')==='invitations/accept' && request.method==='POST') {
      const input=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),display_name:z.string().trim().min(1).max(80)}).strict().parse(body);
      return answer(await workspaceWrite(null,'join',{display_name:input.display_name,token_hash:createHash('sha256').update(input.token).digest('hex')}));
    }
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
      if (path[2] === "audit" && path.length === 3 && request.method === "GET" && request.nextUrl.searchParams.has("limit")) {
        return answer(await auditPage(client, z.uuid().parse(path[1]), user.id, request.nextUrl.searchParams));
      }
      const id = z.uuid().parse(path[1]); const state = await snapshot(client, id);
      const appConfig = githubAppConfig();
      const appBinding = () => state.workspace.is_demo ? undefined : bindingForWorkspace(appConfig,id);
      const risks = () => risksFor(state.tasks, state.edges, state.evidence, state.members, state.workspace.review_threshold_hours, new Date(), state.workspace.tracked_branch);
      if (request.method === "GET") {
        const selected = request.nextUrl.searchParams.get("selected");
        switch (path[2]) {
          case "dashboard": return answer({ project: { id, name: state.workspace.name, role: uiRole(state.role) }, description: state.workspace.description, is_demo: state.workspace.is_demo, fixture_label: state.workspace.fixture_label, plan_version: state.workspace.plan_version, as_of: new Date().toISOString(), tasks: state.tasks, members: state.members.map(m => ({ ...m, role: uiRole(m.role) })), counts: { total: state.tasks.length, ...Object.fromEntries(["todo","in_progress","blocked","done"].map(s => [s, state.tasks.filter(t => t.status === s).length])) } });
          case "tasks": return answer(state.tasks);
          case "dependencies": return answer({ nodes: state.tasks, edges: state.edges, plan_version: state.workspace.plan_version, selected_task_id: selected, downstream_ids: selected ? downstream(state.tasks.map(t => t.id), state.edges, selected) : [], upstream_ids: selected ? downstream(state.tasks.map(t => t.id), state.edges, selected, true) : [] });
          case "risks": return answer(risks());
          case "proposals": return answer(state.proposals);
          case "audit": return answer(state.audit);
          case "integrations": { const bound = appBinding(); return answer({ ai_configured: configured(), ai_provider: "gemini", ai_model: process.env.GEMINI_MODEL ?? null, github_configured: Boolean(bound || state.workspace.github_repository) || state.evidence.some(e => e.origin === 'github'), github_repository: bound?.repository ?? state.workspace.github_repository, github_app_bound: Boolean(bound), github_evidence_imported: state.evidence.some(e => e.origin === 'github'), mode: state.workspace.is_demo ? "demo" : "manual" }); }
          case "settings": return answer({...state.workspace,my_role:state.role,members:state.members,invitation_email_configured:!state.workspace.is_demo && invitationEmailConfigured(inviteEmailConfig)});
          case "github": {
            const bound = appBinding();
            if (bound) {
              const base = {connected:true,repository:bound.repository,mode:"app",runs:[],pulls:[],deliveries:[],observed_at:null};
              if (!githubAppReady(appConfig)) return answer({...base,warning:"GitHub App credentials are not configured."});
              try { return answer({...base,...await appRepositoryActivity(appConfig,id,state.workspace.tracked_branch)}); }
              catch { return answer({...base,warning:"GitHub App access could not be verified. Ask your administrator."}); }
            }
            const repository = state.workspace.github_repository;
            if (!repository) return answer({ connected: false, repository: null, runs: [], warning: null });
            try {
              const runs = await recentPublicRuns(repository, state.workspace.tracked_branch);
              return answer({ connected: true, repository, runs, warning: null });
            } catch {
              return answer({ connected: true, repository, runs: [], warning: "GitHub activity is temporarily unavailable. Your workspace link is unchanged." });
            }
          }
          case "invitations": {
            if(!['owner','manager'].includes(state.role)) throw new HttpError(403,'Manager access required');
            const result=await client.from('tf_invites').select('id,email,role,created_at,expires_at,accepted_at,revoked_at').eq('workspace_id',id).order('created_at',{ascending:false}).limit(50);
            if(result.error) databaseError(result.error);return answer(result.data);
          }
        }
      }
      if(path[2]==='settings' && request.method==='PUT') {
        const input=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(1000),tracked_branch:z.string().trim().min(1).max(100),review_threshold_hours:z.number().int().min(1).max(168),base_plan_version:z.number().int().positive()}).strict().parse(body);
        return answer(await workspaceWrite(id,'settings',input));
      }
      if (path[2] === "github" && path.length === 3 && request.method === "POST") {
        if (!['owner', 'manager'].includes(state.role)) throw new HttpError(403, "Manager access required");
        if (appBinding()) throw new HttpError(409, "This workspace uses an administrator-authorized GitHub App repository.");
        const input = z.object({ repository: z.string().min(3).max(160).nullable(), base_plan_version: z.number().int().positive() }).strict().parse(body);
        let repository: string | null = null;
        if (input.repository !== null) {
          try { repository = await verifyPublicRepository(input.repository); }
          catch (cause) {
            const message = (cause as Error).message;
            throw new HttpError(message.includes('right now') || (cause as Error).name === 'TimeoutError' ? 503 : 422, message);
          }
        }
        const result = await client.rpc("tf_github_link", { w: id, repo: repository, expected_version: input.base_plan_version });
        if (result.error) databaseError(result.error);
        return answer({ repository: result.data.github_repository, plan_version: result.data.plan_version });
      }
      if(path[2]==='invitations' && path.length===3 && request.method==='POST') {
        const input=z.object({email:z.email().max(254),role:z.enum(['manager','member','viewer']),send_email:z.boolean().default(false)}).strict().parse(body);
        const token=randomBytes(32).toString('hex');
        const invitation=await workspaceWrite(id,'invite',{email:input.email,role:input.role,token_hash:createHash('sha256').update(token).digest('hex')});
        // Only after the RPC authorizes and commits the email-bound invitation. Demo data never sends mail.
        let email_status: InvitationEmailStatus = "not_requested";
        if(input.send_email) {
          email_status = state.workspace.is_demo ? "not_configured" : await sendInvitationEmail({
            id:invitation.id,email:invitation.email,role:input.role,workspace:state.workspace.name,token,
          },inviteEmailConfig);
        }
        return answer({...invitation,token,invite_url:invitationURL(token,inviteEmailConfig),email_status});
      }
      if(path[2]==='invitations' && path[4]==='revoke' && request.method==='POST') return answer(await workspaceWrite(id,'revoke_invite',{invite_id:z.uuid().parse(path[3])}));
      if(path[2]==='members' && path[4]==='role' && request.method==='PUT') {
        const input=z.object({role:z.enum(['manager','member','viewer'])}).strict().parse(body);
        return answer(await workspaceWrite(id,'role',{...input,user_id:z.uuid().parse(path[3])}));
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
        return answer(risksFor(fresh.tasks, fresh.edges, fresh.evidence, fresh.members, fresh.workspace.review_threshold_hours, new Date(), fresh.workspace.tracked_branch));
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
    if (path[0] === "risks" && path[2] === "recovery-options" && path.length === 3 && request.method === "GET") {
      const riskId = z.uuid().parse(path[1]);
      const state = await snapshot(client, await scopedWorkspace(client, "tf_evidence", riskId));
      const risk = risksFor(state.tasks,state.edges,state.evidence,state.members,state.workspace.review_threshold_hours,new Date(),state.workspace.tracked_branch).find(r=>r.id===riskId);
      if (!risk?.active || risk.stale_evidence) throw new HttpError(409,"Risk evidence is resolved or stale. Refresh the source first.");
      return answer({ options: buildRecoveryOptions(state.tasks,state.edges,state.members,risk.evidence.task_id,risk.evidence.kind), plan_version: state.workspace.plan_version });
    }
    if (path[0] === "risks" && path[2] === "analyze" && request.method === "POST") {
      const riskId = z.uuid().parse(path[1]); const id = await scopedWorkspace(client, "tf_evidence", riskId);
      const mode = request.nextUrl.searchParams.get("mode") ?? "gemini";
      if (!["gemini","rules"].includes(mode)) throw new HttpError(422, "Unknown analysis mode");
      const strategy = request.nextUrl.searchParams.get('strategy') ?? undefined;
      if (strategy && (mode !== 'rules' || !['coverage','priority','sequence'].includes(strategy))) throw new HttpError(422,'Invalid recovery choice');
      return answer(await recovery(client, await snapshot(client, id), riskId, mode, request.headers.get("Idempotency-Key") ?? "", strategy));
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
