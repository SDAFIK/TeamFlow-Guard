# Build Roadmap — Codex Phases and Acceptance Gates

## Working agreement

- Work in one vertical phase at a time. At the end, update the project build log with commit/branch, screenshots, test results, whether data is demo or connected, gaps and requested sign-off.
- Codex must not quietly expand scope. Confirm any new paid service or permission request.
- Prefer a GitHub feature branch and PR per phase; merge only after tests and human review. Preserve existing repository changes.
- A checked task is not "done" unless behavior is demonstrated. Record FAIL/BLOCKED honestly.

## Phase 00 — Repository orientation and acceptance contract

**Outcome:** current repo inventoried; build plan and design references agreed.

- Inspect existing code, git status, package manifest, design assets and tests. Do not delete unrelated work.
- Initialize strict Next.js TypeScript App Router only if no codebase exists; choose stable versions.
- Add safe `.gitignore`, `.env.example`, `AGENTS.md`, README, scripts and CI plan.
- Sketch routes/component tree and provide a rendered or static page layout preview.

**Gate:** documented assumptions and gaps, clean baseline build or explicit inherited failures, user confirms scope.

## Phase 01 — Premium UI shell and responsive navigation

**Outcome:** functioning app shell using two visual reference PNGs.

- Design tokens, sidebar, top bar, layout containers, typographic hierarchy and badges.
- Pages load with actual route navigation: overview, risks, tasks, dependencies, decisions, capacity, audit, settings.
- Keyboard focus, contrast, mobile navigation and non-decorative buttons checked.

**Gate:** screenshots at 1440×900 and 390×844 and route navigation Playwright test. No clipped UI.

## Phase 02 — Auth, workspace, database and seed fixture

**Outcome:** persistence, access controls and repeatable demo workspace.

- Supabase Auth sign-in/sign-out, memberships/roles, project/workspace selection.
- SQL migrations for the minimum tables, RLS and tests for cross-workspace read/write denial.
- Seed six fictional people and Checkout Launch project; fixture/reset command scoped only to demo workspace.

**Gate:** fresh database migration + seed succeeds; authorized access works; cross-tenant read and unauthorized write fail.

## Phase 03 — Task board and dependency graph

**Outcome:** real task CRUD and navigable directed graph.

- Task statuses, owners, priority, due dates, dependency edges and version field.
- Guard against cycles and cross-project/workspace edge errors.
- Render click-to-inspect graph and accessible equivalent list.

**Gate:** create/edit/assign/dependency path persists after reload; cycle, permissions and mobile tests pass.

## Phase 04 — Four-risk deterministic engine

**Outcome:** inspectable CI, dependency, PR and opt-in capacity risks.

- Build the four domain detectors and event normalization from seed records.
- Risk list/detail, linkable source evidence, downstream impacts and severity explanations.
- Recompute on relevant event/task updates; idempotently update risk lifecycle.

**Gate:** at least 10 tests per category/negative cases planned and exercised; graph impact is exact; all four appear in dashboard.

## Phase 05 — AI proposal generation

**Outcome:** server-only provider adapter with schema-bound recovery suggestions.

- Configure chosen eligible Gemini model via environment; use official SDK and supported structured-output API at implementation time.
- Bounded evidence builder, prompt versioning, schema validation, ID/action allowlist and model errors.
- User explicitly clicks "Generate recovery plan"; loading, timeout, 429 and no-key states.
- Visibly labeled example proposal when service unavailable; do not claim live generation.

**Gate:** real configured-provider request can be demonstrated in a safe environment, or status explicitly blocked; schema and adversarial cases pass.

## Phase 06 — Human decisions, transactions and audit

**Outcome:** most important proof of the product.

- Proposal detail UI matching approval reference, before/after diff and uncertainties.
- Approve and Reject with server-side role check, stale-version checks and atomic transaction.
- Append-only audit with actor, time, source IDs, old/new state, decision status.

**Gate:** rejection changes no task; approval changes allowed internal tasks exactly once; duplicate/stale/unauthorized operations fail; state survives reload.

## Phase 07 — GitHub real data ingestion (after core)

**Outcome:** optional credible connected CI/PR source.

- User authorized GitHub App installation or limited read-only integration.
- Verify signature, parse known event types and deduplicate deliveries.
- Show "Connected" or "Demo" badges and source URL.
- Re-run risk engine for a real allowed event; do not write to GitHub.

**Gate:** signed example webhook accepted; invalid signature denied; duplicate ignored; source event renders. If no user permission/credentials, leave this phase explicitly incomplete and retain a truthful demo mode.

## Phase 08 — Full quality pass, design and competition demo

**Outcome:** browser walkthrough reliable and reproducible.

- Run full lint/typecheck/unit/integration/e2e/build.
- Test empty, loading, API fail, 429, no network and access denied.
- Review accessibility, screen widths, audit accuracy, security, data retention and logs.
- Produce demo README, screenshots, demo reset script, actual architecture diagram and evidence list.

**Gate:** critical tests green; judge can reproduce seed → risk → proposal → approval → audit; all known blockers listed.

## Phase 09 — GitHub publication, Vercel release and smoke test

**Outcome:** accessible public URL and verifiable source repo.

- User authorizes repo publishing; scrub secrets, sample data and test credentials.
- Commit/tag stable release, CI green, configure Vercel project and server-side env vars.
- Apply production migrations safely; set auth redirects and source webhooks, redeploy.
- Browser smoke-test production URL as a fresh user, including AI and approval if configured.

**Gate:** repo URL, production URL, CI run, recorded release commit SHA and release smoke-test results. No credentials in repository.

## Phase 10 — Competition form and 180-second video

**Outcome:** submission matches observed implementation.

- Fill form using `COMPETITION_FORM_EVIDENCE.md`: only checked tools truly present in code/usage logs.
- Record actual model name, provider, prompt version, retrieval method (if any), tests, privacy controls and deployed preview.
- Produce 180-second video showing real browser flow; no stock footage that substitutes for the working demo.
- Upload video as Public or Unlisted as required by event; recheck portal's current published rules.

**Gate:** reviewer can open video, demo and repo without unauthorized access, all field claims trace to evidence, all links verified.

## Prioritization if competition time is limited

**P0:** phases 00–06 and 08–10. **P1:** phase 07 GitHub connection and polish. **P2:** extra providers, notifications, rich analytics. Never sacrifice human approval, backend validation or audit to build extra animations.

## Phase completion log template

```text
PHASE:
USER-VISIBLE OUTCOME:
FILES / COMMIT:
TEST COMMANDS + RESULTS:
SCREENSHOT REFERENCES:
REAL VS SEEDED DATA:
AI MODEL + OBSERVED RESPONSE STATUS:
SECURITY / PRIVACY REVIEW:
KNOWN FAILURES:
USER ACTION REQUIRED:
NEXT PHASE:
```
