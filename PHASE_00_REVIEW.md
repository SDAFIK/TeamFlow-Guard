# TeamFlow Guard — Phase 00 review

Prepared 8 November 2026. Status: proposed design and contracts, awaiting Phase 01 approval. No application is implemented.

## Observed workspace and inputs

`D:\TeamFlow Guard` is empty at initial inspection and `git status --short` reports that it is not a Git repository. There are no source files, package manifests, migrations, fixtures, tests, runtime commands, configured integrations or deployment files to validate. Node, npm, Python and Git are discoverable on PATH; Docker and psql are not. This does not prove that PostgreSQL or Docker are absent elsewhere, or that the available runtimes meet future requirements.

Read all six supplied documents from Downloads: AGENTS, PRODUCT_SPEC, ARCHITECTURE, BUILD_PHASES, DEMO_SCENARIO and CODEX_MASTER_PROMPT. Reviewed both supplied screenshots as concept references. README, COMPETITION_FORM_ANSWERS and the old TeamFlow AI PRD were not supplied and do not exist in this workspace. Historical PRD reconciliation and competition eligibility cannot be verified.

## Product agreement proposed

Canonical name: **TeamFlow Guard**. Canonical seeded project: **RetailFlow Checkout**, organization DemoWorks, fictional team Asha (lead), Rahim (backend), Nila (auth/frontend), Arif (checkout), Sami (QA).

The single product loop is observed risk signal → inspectable source evidence → deterministic dependency impact → typed AI recovery proposal → validated human decision → persisted plan and audit. AI never grants itself permission to change the plan.

Use the screenshots for hierarchy, restrained navy surfaces, teal actions and amber/red status accents. Replace their inconsistent people, sprint numbers and January 2025 dates with one fixture clock and project context. Retain a visible Demo data / Replayed event label. The primary demo follows Login → Checkout → QA → Release, with Auth preceding Login and Catalog as independent work. A failed Login check is linked to Login; it must not be portrayed as a failed Auth check. Counts are computed from these persisted relationships, never copied from the screenshots.

Do not display an unmeasured confidence score, release probability, percentage health trend, or a promise that a proposal will fix CI. Approval changes the plan; only a subsequent observed passing check clears a CI failure. Distinguish affected root tasks from downstream successors in count labels.

Proposed conflict resolutions: read-only GitHub integration is Phase 06/P1, while P0 can demonstrate explicitly labeled replay events. Responsive core flows are P0, despite expanded mobile appearing in P2. Rollback means a newly validated compensating proposal and audit event, never deletion of history. Defer optional retrieval, LangGraph, MCP, n8n and pgvector.

## Visual blueprint

See `design/overview-desktop.svg` (1440 px), `design/overview-mobile.svg` (390 px), and `design/risk-and-approval.svg`. These are static annotated wireframes, not a functioning product or browser-tested implementation.

Desktop: 224 px persistent navigation; project breadcrumb and scenario label; four compact source-backed summaries; dependency impact map beside the highest-priority evidence-backed risk; risk feed and pending decisions below. Avoid sparklines until time-series data exists. The map uses text statuses plus color and has a list alternative.

Mobile: compact project header and navigation menu; two-by-two summaries; primary risk and review action before the dependency list; pending decisions next. The full graph is an optional view, not a horizontally squeezed desktop graph. Proposal comparison becomes stacked field/before/proposed groups with a bottom action area that never covers content.

Risk detail: title, severity reason, observed timestamp and source freshness first; exact source IDs and check URL; highlighted downstream tasks; separate observed facts, inferred impact and assumptions. Analyze opens a right-side recommendation drawer on desktop and full-screen dialog on mobile. It shows generation status, validated candidate actions, source references and limitations. Review opens a before/after modal, with current plan version and identity of the approving lead.

Approval modal: each changed field displays task, before and proposed value. Show expected effect as an estimate. Approve & apply is enabled only for an authorized lead and a validated, current proposal. Reject requires no plan changes. A stale conflict preserves the proposed diff for inspection and offers regeneration; it never silently rebases. Success links to the updated task and audit event. Focus returns to the initiating control when a dialog closes.

## Route and interaction map

All routes below are proposed, not available now. Future navigation is exposed only when implemented; unavailable features have a visible explanation.

| Route/control | Click result and state handling |
|---|---|
| `/login` | Sign in; show field errors and authentication failure; return to authorized project. |
| Project selector | List memberships; selecting a project reloads scoped data; no membership shows access help. |
| `/projects/:id/overview` summary cards | Open Risks, Tasks filtered blocked, or Decisions filtered pending. Release status opens its rule explanation, not a fabricated forecast. |
| Risk row / View evidence | Open risk detail; evidence opens a stored source panel and explicit external source link. Missing source is marked unavailable. |
| `/projects/:id/risks` | Search stored titles/IDs, filter severity/type/status, clear filters; distinguish no risks from no matching results. |
| Replay CI failure | In demo mode only, ingest a labeled deterministic sample event; disable while pending; show created or already-ingested result. |
| Analyze and suggest recovery | Start bounded model request; show pending, failure/retry or stored proposal. No active-plan mutation. |
| Review proposal / decision row | Open proposal diff and evidence; show unavailable/stale state if its version is no longer current. |
| Approve & apply | Submit version and idempotency key once; pending prevents repeat UI submission; server enforces at-most-once application. Show task changes and audit link. |
| Reject proposal | Record rejected status and audit; keep active plan unchanged; return to pending queue. |
| Edit proposed action | Edit draft only, then validate a new proposal revision; never change an already approved diff. |
| `/projects/:id/tasks` | Switch list/board; filter owner/status; open task details; contributors update allowed statuses. Protected field edits become reviewable proposals. |
| `/projects/:id/dependencies` | Select Login to highlight reachable successors; open task; zoom/reset; list alternative. Edge edits validate project scope and cycles before a proposal can apply. |
| `/projects/:id/team` | View explicit availability; member edits their own voluntary hours. Do not infer health or productivity. |
| `/projects/:id/audit` | Filter events, open immutable field-level diff and source proposal. |
| `/projects/:id/settings` | Project configuration and integration status, restricted by role; no decorative connect buttons. |
| Mobile menu / dialog close / Escape | Open navigation, close dialog, restore focus; trap focus only within active modal. |

Common states: skeletons retain headings; errors offer retry without discarding filters; 403 hides protected data; stale evidence carries its age; empty queues have truthful explanations; buttons have descriptive labels and keyboard focus. Use semantic headings, 44 px touch targets, sufficient contrast and reduced-motion support. Recheck all these in the actual browser once code exists.

## Smallest maintainable architecture

One repository with `web/` (Next.js, TypeScript), `api/` (FastAPI, Pydantic, SQLAlchemy/Alembic), `contracts/` (generated OpenAPI client), `tests/` and `docs/`. One PostgreSQL database. One backend application owns access checks, risk rules, proposal validation and transactional approval; no microservices or queue infrastructure initially. A provider adapter isolates the later runtime LLM choice. Use bounded synchronous analysis initially; adopt durable jobs only if observed execution times require them.

Use an established authentication library/provider rather than custom password cryptography. Proposed browser access through one origin to avoid unnecessary CORS and cookie complexity. The backend validates authenticated identity and looks up current project membership independently of client claims. Exact auth provider, hosting and LLM provider remain open decisions, not selected services.

Phase 01 entities: User, Organization, Project, ProjectMembership, PlanVersion, Task, TaskDependency and fixture metadata. Initial task relations are seeded and read-only; public dependency editing waits for Phase 02. Add Availability and evidence/risk entities when their slices need them; proposal, decision and audit tables before protected mutations. Avoid creating all optional architecture entities on day one.

Task identity stays stable across plan revisions. Task versions and the proposal's typed diff preserve before/after history. Proposal includes project ID, base plan version, immutable candidate revision/hash, evidence IDs, allowed actions and validation state. Audit records actor, timestamp, request ID, proposal and exact applied diff; application permissions prevent history updates/deletes.

At approval: authorize membership → lock current project plan version → check proposal status/revision/base version → validate referenced IDs, before-values, capacity and DAG → apply diff and version increment → append decision and audit → commit. Any failure rolls back the entire operation. Scope idempotency keys to actor/project/operation and reject key reuse with a different payload. A duplicate identical request returns the original result.

## Proposed API contracts

Prefix routes with `/api`; publish Pydantic-derived OpenAPI and generate TypeScript types. All project resources enforce authorization, including nested IDs. Return structured `{code, message, request_id, details}` errors without secret values.

| Endpoint | Result / invariants |
|---|---|
| `GET /health/live`, `/health/ready` | Process liveness; readiness checks database connectivity without exposing credentials. |
| `GET /me`, `GET /projects` | Authenticated identity and authorized memberships only. |
| `GET /projects/{id}/dashboard` | Project, plan version, computed counts, `as_of`, data origin. Unimplemented risk metrics omitted, not zero-filled. |
| `GET /projects/{id}/tasks` | Scoped task records, status, owner, version and evidence links; pagination/filter parameters. |
| `PATCH /tasks/{id}` | Allowed status fields only with expected task version; protected fields rejected or routed to proposal workflow. |
| `GET /projects/{id}/dependencies` | Typed nodes/edges, graph version; impact selected by authorized task ID. |
| `POST /projects/{id}/demo-events` | Demo-only fixture event type and replay ID; labeled persisted source; deduplicated. |
| `GET /projects/{id}/risks` | Deterministic severity/reasons, evidence IDs, affected tasks, freshness and pagination. |
| `POST /risks/{id}/analyze` | Persisted analysis/run with validated references; bounded timeout error; no protected writes. |
| `POST /risks/{id}/recovery-proposals` | Store typed candidate revision/diff and validation result; no apply. |
| `POST /proposals/{id}/decision` | `{decision, base_plan_version, proposal_revision}` plus Idempotency-Key; result includes decision, new/current plan version and audit ID. |
| `GET /projects/{id}/audit` | Authorized immutable events, paginated. |
| `POST /webhooks/github` | Verify signature over raw bytes; unique delivery ID; normalize mapped events; never trust source text as instructions. |

Use 401 unauthenticated, 403 forbidden, 404 unavailable resource, 409 stale version/idempotency mismatch, 422 invalid action/cycle and 503 dependency unavailable. Choose a consistent non-disclosing 404 policy for cross-project object lookup. All timestamps UTC in API, localized in UI; dates in seed fixtures use a declared simulated clock.

## Prioritized vertical slices

| Phase | Tickets in dependency order | Visible acceptance evidence |
|---|---|---|
| 01 | 1A repository/runtimes/health; 1B PostgreSQL migrations and repeatable five-person seed; 1C auth + project membership enforcement; 1D responsive read-only persisted overview | Lead signs in, sees RetailFlow tasks and members, refresh preserves data; other project blocked. Risk and AI areas clearly unavailable until later phases. |
| 02 | 2A task status/history; 2B validated dependency API; 2C impact graph/list | Selecting Login highlights actual successors; cycle submission fails; independent Catalog stays outside the cascade. |
| 03 | 3A normalized evidence + demo replay; 3B four deterministic risk rules; 3C queue/detail | Replay produces source-linked risk and computed impact; no-risk controls remain clear. |
| 04 | 4A selected provider adapter + budgets; 4B typed outputs/reference validation; 4C analysis drawer | Actual provider request creates a traceable pending candidate; outage leaves manual board usable. |
| 05 | 5A diff validation; 5B transactional approval/reject/idempotency; 5C decision UI/audit | Lead approves once, version advances and refresh preserves change; contributor, stale and duplicate requests cannot double-apply. |
| 06 | 6A test-repo read-only connection; 6B signed deduplicated ingestion; 6C source freshness/retry UI | Real failed check creates mapped evidence; replay remains visibly distinct. |
| 07 | 7A 30-case evaluation; 7B security/accessibility/load checks; 7C approved staging/production deployment and pilots | Publish measured results including failures and a verified HTTPS demo. |
| 08–09 | Optional evidence-backed additions only after P0 stability; then freeze/reset/backup/demo | Technology claims match actual code and logs; rehearsed recording and recoverable seed. |

The supplied 26 December 2026 target leaves about seven weeks. Treat dates as targets, not commitments. If the core loop slips, omit Phase 08 entirely. Five suggested workstreams: product/scenarios, frontend, backend/data, rules/AI, QA/operations. No external assignments or messages have been sent.

## Verification and fallback plan

Phase 01: Pytest health/readiness/auth/access tests against real PostgreSQL; migration upgrade/downgrade/re-upgrade against a disposable database; deterministic seed rerun; server-side role tampering test; frontend typecheck/lint/build; Playwright sign-in, membership isolation and refresh persistence; desktop 1440 and mobile 390 browser screenshots and keyboard walkthrough. Record actual commands, exit codes and artifacts in PHASE_PROGRESS.md. Do not run migration downgrade against shared/production data.

Later mandatory regression cases: failed Login CI impact; two-day voluntary absence; cycle rejection; zero-capacity assignee rejection; contributor approval denied; rejection preserves plan; duplicate approval applies once; stale proposal conflict; cross-project lookup denied; model timeout preserves board; refresh retains approved change and audit; demo works with labeled replay when GitHub is unavailable. Add concurrent approvals, transaction rollback, invalid/hallucinated evidence IDs, source prompt injection, expired sessions, bad webhook signature and duplicate delivery.

Risk rules must pass independently of an LLM. Model evaluation uses at least 30 mixed positive/negative cases and reports precision/recall, citation validity, schema validity, latency and measured cost, without treating targets as achieved results. Verify rule severity explanations and model assumptions separately.

Fallbacks: unavailable GitHub → explicit replay/manual event path; unavailable model → recoverable error or explicitly labeled deterministic suggestion, never fake generated output; unavailable database → read error with retry, no simulated save success; unavailable capacity → flag unknown and block unsupported reassignment; no feasible recovery → say so and allow manual review.

## Deployment, cost and decisions

Proposed deployment: one web service, one API service, managed PostgreSQL, separate staging and production databases. Use environment-managed secrets, server-only provider keys, HTTPS, health checks, controlled migrations, backups and restore rehearsal. CI runs test/build gates before release. Application rollback uses a prior release; schema changes should remain backward-compatible. No provider is provisioned and no external mutation or deployment is authorized by this document.

Costs to approve before provisioning: web/API compute, PostgreSQL storage/backups, authentication, logs and model inference. Do not quote unverified current prices. Log provider-reported usage, enforce input/output limits and configurable per-project request budgets; calculate actual cost only after selecting a provider and verifying its pricing. Avoid optional vector and workflow services until demonstrated necessary.

Decisions needed for Phase 01: approve the visual/product direction; choose local PostgreSQL (via an available installation/container runtime) or a managed development database; choose an authentication approach. Runtime LLM and final hosting can remain undecided until their phases, but require explicit selection before integration/provisioning. Missing old PRD and competition form are non-blocking for the foundation but block historical reconciliation and checkbox verification.

## 60-second intended demo

0–8s: lead signs in and opens labeled RetailFlow demo. 8–18s: replay a failed Login check and inspect its source. 18–28s: highlight Login → Checkout → QA → Release, leaving Catalog independent. 28–40s: request actual analysis and inspect cited proposal (generation time is observed, never concealed with a fake result). 40–52s: review before/after and approve a feasible reviewer reassignment or independent-task reordering. 52–60s: show incremented plan version, audit entry and refresh persistence. If inference exceeds the slot, disclose a previously generated stored analysis. Demonstrate reject and the absence scenario separately in the longer recording.

After Phase 01 alone, only login, memberships, stored tasks/team and read-only overview are expected to work. The full demonstration requires later phases; no AI, risk or approval functionality is claimed by the foundation.

## Phase 00 evidence and gate

Completed: read-only workspace/tool inspection, six-document review, screenshot-based design reconciliation, static annotated wireframes, proposed interactions/contracts/tickets and verification plan. No app tests, model calls, external integration, browser verification or deployment occurred. No executable app or working URL exists.

Next gate: review these artifacts and explicitly approve Phase 01. This gate follows the user-selected CODEX_MASTER_PROMPT first-run scope, not an inferred plugin approval requirement.
