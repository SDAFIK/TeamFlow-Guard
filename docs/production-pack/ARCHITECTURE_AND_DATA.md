# Architecture, Domain Model and API Contracts

## Deployable topology

One **Next.js** deployable on Vercel (UI, authenticated route handlers/server actions, webhook receiver and AI provider adapter) + one **Supabase** instance (Auth + Postgres). Avoid a separate Python service, Redis or multi-agent platform until justified by an actual bottleneck.

```text
Browser
  ├─ Next.js UI (Server Components + client interaction)
  └─ Next.js server/API (auth, permissions, validation)
       ├─ domain/riskEngine.ts (pure deterministic logic)
       ├─ domain/dependencyGraph.ts (DAG / downstream propagation)
       ├─ server/ai/recovery.ts (schema-bound model adapter)
       ├─ server/decisions.ts (transaction + authorization)
       ├─ server/integrations/github.ts (optional read-only ingestion)
       └─ Supabase Auth/Postgres
```

## Suggested modules

```text
src/
  app/(public)/page.tsx
  app/(auth)/login/page.tsx
  app/(workspace)/overview/page.tsx
  app/(workspace)/risks/page.tsx
  app/(workspace)/risks/[id]/page.tsx
  app/(workspace)/tasks/page.tsx
  app/(workspace)/dependencies/page.tsx
  app/(workspace)/decisions/page.tsx
  app/(workspace)/decisions/[id]/page.tsx
  app/(workspace)/capacity/page.tsx
  app/(workspace)/audit/page.tsx
  app/api/github/webhook/route.ts
  app/api/health/route.ts
  features/{dashboard,risks,tasks,dependencies,decisions,capacity}/
  components/ui/
  domain/{riskEngine,dependencyGraph,riskTypes,proposalSchema}/
  server/{db,auth,permissions,ai,integrations,mutations}/
  lib/{env,errors,logging,dates}/
supabase/migrations/
supabase/tests/
tests/{unit,integration,e2e,fixtures}/
design/reference/
docs/{adrs,demo,runbooks}/
```

Choose final structure based on the existing repository, not by duplicating existing modules.

## PostgreSQL tables (conceptual DDL specification)

All tenant-owned tables must have `workspace_id UUID NOT NULL`. Migrations define foreign keys, indexes and RLS policies; indexes should lead with workspace ID for frequently queried records.

| Table | Essential fields | Important constraints |
|---|---|---|
| `profiles` | user_id PK, display_name, avatar_url | References `auth.users` |
| `workspaces` | id PK, slug, name, is_demo | Unique slug |
| `memberships` | workspace_id, user_id, role | Composite uniqueness, enum role |
| `projects` | id, workspace_id, name, release_target | Workspace FK |
| `tasks` | id, workspace_id, project_id, external_ref, title, status, priority, assignee_id, due_at, version | Optimistic version; workspace-scoped external IDs |
| `task_dependencies` | workspace_id, predecessor_task_id, successor_task_id | No self-edge, unique edge, both tasks same workspace; reject cycles in service |
| `evidence_events` | id, workspace_id, provider, external_id, kind, occurred_at, payload_sanitized, source_url | Unique provider/external ID per workspace; no secrets/raw PII |
| `pull_requests` | id, workspace_id, repo_ref, pr_number, task_id, state, is_draft, review_requested_at, reviewer_id | Unique repository+PR key per workspace |
| `capacity_reports` | id, workspace_id, user_id, start_at, end_at, availability_pct, note_visibility | Self-report only; strict access policies |
| `risks` | id, workspace_id, project_id, category, severity, state, primary_evidence_id, explanation, evaluated_at | Category enum: ci/dependency/pr/capacity |
| `risk_impacts` | risk_id, workspace_id, task_id, relation, basis | Unique pair, factual vs estimated distinction |
| `recovery_proposals` | id, workspace_id, risk_id, model_provider, model_name, prompt_version, input_evidence_ids, structured_plan, status, created_by, created_at, version | Status pending/approved/rejected/expired/applied/failed |
| `decisions` | id, workspace_id, proposal_id, actor_id, decision, reason, decided_at | One finalized decision per proposal |
| `audit_events` | id, workspace_id, actor_id, event_type, target_type, target_id, previous_value, new_value, source_evidence_ids, occurred_at | Append-only from application roles; never editable by client |
| `integration_connections` | id, workspace_id, provider, external_installation_id, status, permission_summary | Secret reference in protected server storage only |
| `webhook_inbox` | id, workspace_id, provider, delivery_id, type, received_at, processed_at, state | Unique delivery ID for idempotence |

## Authorization and RLS

- Authenticated users may view only records belonging to their current membership workspace.
- A requester may not forge an arbitrary workspace ID in a URL or JSON payload to see another team's data.
- Only owner/manager can approve permitted in-app task changes; browser cannot write audit rows directly.
- A member can manage their own capacity report. Managers see only aggregated/necessary availability fields, not private notes by default.
- `service_role` keys are **server-only**. Public/publishable Supabase key may be in the browser only with robust RLS and appropriate grants.
- Test `SELECT`, `INSERT`, `UPDATE`, `DELETE` allow/deny for each role and cross-workspace user.

## Read APIs and mutations (suggested)

| Operation | Behavior |
|---|---|
| `GET /api/health` | Minimal non-sensitive health indicator (no secrets) |
| `GET /api/risks?workspace=...` | Authorized filtered/paginated list |
| `GET /api/risks/:id` | Evidence, impacts, source references |
| `POST /api/tasks` | Validate, authorize, commit; audit |
| `PATCH /api/tasks/:id` | Optimistic `version` precondition; reject stale request |
| `POST /api/risks/:id/proposals` | Rate-limit, collect bounded evidence, call AI server-side, validate and persist proposal |
| `POST /api/proposals/:id/approve` | Authorized atomic compare-and-swap + allowlisted actions + audit |
| `POST /api/proposals/:id/reject` | Authorized state transition + audit; **no** task mutation |
| `POST /api/github/webhook` | Verify raw body signature + delivery ID, record/process allowed event types |

Use framework-appropriate server actions or route handlers; names are proposed contracts, not a requirement to duplicate both mechanisms.

## Approval transaction pseudocode

```ts
transaction(async (db) => {
  const user = await requireAuthenticatedUser();
  const proposal = await db.proposal.lockForUpdate(proposalId);
  assertMembershipAndApprovalRole(user, proposal.workspaceId);
  if (proposal.status !== 'pending') throw conflict('Already decided');
  assertEvidenceAndTaskVersionsStillCurrent(proposal);
  const changes = validateAllowlistedActions(proposal.structuredPlan);
  await applyInAppChangesWithVersionChecks(db, changes);
  await db.decision.insert({ proposalId, actorId: user.id, decision: 'approve' });
  await db.audit.insert(buildAuditRecord(changes, user, proposal));
  await db.proposal.update({ id: proposalId, status: 'applied' });
});
```

`lockForUpdate` is conceptual; implement with a real database transaction/RPC and row locking or equivalent atomic statement. Do not assume a sequence of separate Supabase client calls is atomic. If any part fails, roll back and display an explicit error.

## Read-only GitHub integration (stretch)

- Prefer GitHub App permissions scoped to specific repositories and minimum needed read access for checks/pull requests/metadata. GitHub Apps provide granular permissions and built-in webhook configuration.
- Verify `X-Hub-Signature-256` using raw payload and secret, constant-time comparison; avoid processing events before verification.
- Deduplicate `X-GitHub-Delivery`, handle out-of-order updates, retry safely.
- Persist referenced fields only, hide private source content and credentials, record connection health.
- External writes are disabled unless an independent later project phase explicitly authorizes their exact scope.

## Operational boundaries

Do not store long-running process state in Vercel memory; Postgres is authoritative. Never rely on a running background worker inside a short-lived request. Keep AI calls bounded; protect against duplicate calls, timeouts, rate limits and large untrusted PR text.
