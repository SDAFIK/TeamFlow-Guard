# Phase progress

## Stage 2 — user journey and product UX hardening, 11 November 2026

- Reworked role-aware overview priority, trustworthy task progress, task/due-date attention order, dependency validation feedback, empty graph/list guidance, task archiving confirmation, workspace settings and invitation/role administration. Added final-layer responsive navy/teal design refinements; fixed missing shared form-grid styling seen on the previous hosted site.
- Frontend checks in this local source: **110 Vitest tests**, ESLint, TypeScript, and production Next.js build passed. Domain tests cover graph conflicts, contextual next action and due-state classification. Mocked Gemini failure/grounding tests passed; no live model call was attempted.
- Added `scripts/ux-smoke.cjs` for mock-browser scenarios at 1440px and 390px. Its execution was attempted, but Chromium could not launch because the execution sandbox denied a browser socket; **do not count it as passed**. Live Supabase persistence, role permissions and cross-user sessions were not verified in this session because credentials are not included in the source-only archive.
- No cloud writes or deployments. Remaining release gates and commands: `docs/UX_STAGE2_RELEASE_NOTES.md`.

## Free hosting preparation — 8 November 2026

- User explicitly selected **free hosting only**. Prepared Render Free + Neon Free; no paid resources or upgrades authorized. Relevant integrations were discovered and offered, but neither account connection has been confirmed. No cloud resources or live URL exist yet.
- Added a multi-stage Docker image: Next.js static export at build time, non-root FastAPI runtime serving UI and API from one origin. Runtime image excludes local secrets, database, migration scripts and test artifacts. `render.yaml` selects `plan: free`, requires runtime URL/origin inputs and disables automatic deploys.
- Added HTTPS/secure-cookie/TLS/runtime-role configuration checks, response security headers, and rejection of migration/seed credentials in production. Hosted setup is an explicit operator command with distinct admin/runtime connections and new hosted demo credentials; it is not executed at app startup.
- Static export build succeeded. **70 backend tests passed** (one upstream deprecation warning), including hosted configuration failures and static/API route isolation. **Six browser tests passed in 29.7 seconds** at 1440×1000 and 390×844 against FastAPI serving the exported app on temporary localhost:3100.
- Docker is unavailable locally; GitHub Actions now builds and smoke-tests the image. The hosted bootstrap command is syntax-checked but cannot be exercised against Neon until connected. No live OpenAI calls were made; key/model remain absent.
- Instructions and current free-tier limits: `deploy/README.md`. Free services can sleep or suspend at quotas; this is a demo hosting target. No production availability or backup/restore claim is made.
- GitHub Actions [42479301037](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/42479301037) passed for source commit `b1cc0ab`: Docker image build/smoke test, frontend lint/build, and backend tests. Local lint also passes with generated export files excluded. The temporary test server was stopped; the normal localhost:3000 preview is retained.

## Current delivery — 8 November 2026

User authorized subsequent phases, visual improvements, OpenAI integration and creation of a GitHub repository. The private repository is https://github.com/SDAFIK/TeamFlow-Guard. Historical phase entries below describe earlier states, not the current feature set.

- Phases 02–03: editable status with optimistic versions and history; scoped acyclic dependencies and impact visualization; CI, blocker, review-delay and explicit-capacity rules; persisted source evidence and labeled replay.
- Phase 04: OpenAI Responses adapter, strict typed action/evidence references, input/output/time/request bounds, failure isolation and run metadata implemented. Real provider execution is **not verified**: API key and model were absent at the latest configuration check. Rule recovery remains independently usable and clearly labeled.
- Phase 05: before/after review, lead-only transactional approval, rejection, current-version checks, source-risk checks, combined reviewer-capacity validation, idempotency receipts, concurrent approval protection and append-only audit. Reordering records the actual shifted task positions as well as the requested change.
- Phase 06: exact repository/workflow/task mapping, signed workflow-run ingestion, duplicate/conflicting delivery checks, out-of-order handling and source isolation. CLI sync reads GitHub without copying credentials into the app. Public webhook hosting is not enabled. Repository workflow is mapped to the demo release task, not falsely attributed to Login UI.
- UI: refreshed shield wordmark, navy/teal dashboard, source-backed statistics, interactive dependency map, task board/list, risk detail, decision review, availability, audit and integration settings. Responsive native dialogs, keyboard focus, transitions and reduced-motion handling are implemented.
- Database: migrated development data non-destructively from WIN1252 to UTF-8; row counts verified during copy; original database retained. `.env` is preserved on database startup.

### Latest local verification

| Check | Observed result |
|---|---|
| Backend tests | **60 passed**; one upstream Starlette/httpx deprecation warning. Includes 30 rule/graph cases, provider validation/failure cases, transactional decisions, capacities and signed GitHub ingestion. These are not 30 live-model evaluations. |
| Alembic schema check | No new upgrade operations detected. Test-only upgrade/downgrade/upgrade included in backend suite. |
| Browser flows | **6 passed** at 1440×1000 and 390×844. Authentication, role-sensitive controls, service failure/retry, filters, dialogs/Escape/focus restoration, replay/evidence, rule proposal/rejection/audit and refresh. No page errors or horizontal overflow in checked flows. |
| Manual browser approval | Approved a local rule proposal; plan advanced from v1 to v2, audit persisted after reload, and failing CI stayed active. |
| Visual QA | Reviewed desktop/mobile screenshots and corrected graph card overlap after task reordering. Modal screenshots use reduced motion to avoid transient capture artifacts. |
| Production compiler | Webpack production compilation/typecheck/static generation passed. Local Turbopack CSS-worker startup failed; build script now explicitly uses supported webpack. |
| Source exclusion | Staged source scanned against local credential values; no matches or ignored data artifacts found. `.env`, local credentials/database and traces remain ignored. |

Artifacts: `evidence/overview-desktop.png`, `evidence/overview-mobile.png`, `evidence/proposal-desktop.png`, `evidence/proposal-mobile.png`. Walkthrough: `DEMO.md`.

### Remaining scope and honest limits

Phase 07 is partial: no live-model quality/cost evaluation, production load test, formal accessibility audit, pilot or hosted HTTPS deployment. No hosting provider/budget has been selected. Phase 08 optional technologies are deferred; Phase 09 has a local walkthrough but no recorded showcase or production backup/restore rehearsal. Full proposed route deep-links, editable proposal revisions/compensating rollback, owner reassignment and production onboarding are not delivered. New proposals can be authored through task/dependency controls; approved records are immutable through application routes.

The source was locally reviewed for authentication, scope, before-value validation, transaction boundaries, evidence integrity and secret exclusion. No PR-specific Code Review connector report is claimed.

### GitHub verification

- Source commit `251657d` uploaded to private `SDAFIK/TeamFlow-Guard`.
- GitHub Actions run [42464766720](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/42464766720) completed **successfully**: frontend lint/build and backend setup/migrations/tests ran on Ubuntu with PostgreSQL 18.
- Local `sync_github.py` ingested that actual completed workflow as GitHub evidence for `REL-106`. A second sync returned “Workflow run already recorded,” verifying deduplication. No GitHub writes occur in the sync script.
- Final browser rerun against the restarted API: **6 passed in 30.0 seconds**. Final desktop/mobile overview captures show one current replay signal; older replay events remain stored but superseded.
- Live OpenAI remains unverified: both key and model settings were still absent at the final presence-only check. No provider credential was printed or committed.

## Phase 00 — 8 November 2026

- Status: planning artifacts prepared; Phase 01 not started.
- Inputs: six supplied Markdown files and two reference screenshots.
- Observed: initially empty workspace; Git reports no repository; Node/npm/Python/Git discoverable; Docker/psql not found on PATH.
- Outputs: PHASE_00_REVIEW.md and three static annotated SVG wireframes in design/.
- Checks: input documents read; workspace inspected. No application exists to build, execute or test. SVG structure verified separately; visual/browser QA remains unperformed.
- Open choices: Phase 01 approval, development PostgreSQL path, authentication approach. LLM and production hosting selection deferred to the phases that need them.
- External changes: none.

## Phase 01 — 8 November 2026

- Authorization: user approved Phase 01 and selected a local development setup.
- Status: foundation implemented and verified locally. Phase 02 has not started.
- Git: initialized on `main`; files remain uncommitted for user review.
- Stack: Next.js 16.4.5 / TypeScript / Tailwind CSS, FastAPI / Pydantic / SQLAlchemy / Alembic, workspace-local PostgreSQL 18.6, pwdlib Argon2 password hashing and database-backed opaque sessions.
- Delivered: login/logout, eight-hour revocable sessions, same-origin protection, server-side project membership and lead settings checks, seven stored tasks and five fictional members, source-backed task counts, searchable/filterable read-only tasks, task dialog, team view, error retry, mobile navigation and keyboard focus handling.
- Database: versioned initial migration; idempotent seed preserves existing records; separate runtime and migration roles; runtime role cannot update task/plan data. Local secrets and database files are ignored by Git.
- Frontend scope: application at `/`; views are in-page navigation in this phase. Future risks/dependencies/decisions/audit controls are disabled and labeled with their phases. No fake risk or AI result is displayed.
- Preview: http://localhost:3000. API health: http://127.0.0.1:8000/health/ready. Demo sign-in details: `.local/DEMO_LOGIN.txt` (local only, ignored by Git).

### Observed verification

| Command/check | Observed result |
|---|---|
| `python setup_local.py` in api with local venv | Migration, seed, runtime grants and OpenAPI export completed. |
| `python -m pytest -q` in api with local venv | **10 passed** in 5.69 seconds. Initial run emitted dependency deprecation warnings; no test failures. |
| Test migration upgrade → downgrade → upgrade | Passed on `teamflow_test` only; development data preserved. |
| `python -m alembic check` in api | **No new upgrade operations detected.** |
| `npm run contracts` | Generated `web/lib/api-schema.d.ts` from exported OpenAPI. |
| `npm run lint` in web, final run | Exit 0, no findings. |
| `npm run typecheck` in web | Exit 0. |
| `npm run build` in web, final run | Exit 0; compiled, TypeScript checked, static page generation completed. |
| Playwright on existing Chromium, 1440×1000 and 390×844 | **4 passed** in 25.6 seconds. Sign-in/out, bad credentials, role-restricted settings, service failure/retry, filters, task details, Escape/focus restoration, refresh and team view. No page errors in main flows, no horizontal viewport overflow. |
| npm dependency audit after targeted minimatch override | **0 vulnerabilities** in both root and web dependency trees at verification time. |
| Secret exclusion | `git check-ignore` confirms api/.env and local credential files are ignored. |
| Visual inspection | Reviewed actual browser screenshots for desktop and mobile; fixed collapsed headline spacing; dev overlay removed. |

Screenshots: `evidence/overview-desktop.png`, `evidence/overview-mobile.png`. Test traces and HTML reports are local ignored artifacts because they may include session information.

### Fixes made during verification

- Corrected the backend environment-file path before migration setup.
- Resolved the published embedded-PostgreSQL version instead of retaining an unavailable version.
- Corrected async-effect lint handling; documented the narrow lint exception for awaited request state updates.
- Fixed browser test ambiguity caused by Next.js's separate route-announcement alert.
- Fixed mobile headline spacing and added navigation focus trapping/Escape handling.
- Updated the lint dependency's minimatch via a scoped override; lint/build still pass.

### Review and limits

Reviewed the new Phase 01 source against its approved scope, with emphasis on password/session handling, membership checks, error behavior, secret exclusion, database grants and fixture disclosure. No external PR exists for the Code Review connector to inspect. No external deployments, integrations, Figma writes, GitHub writes, model calls or messages were made.

This is a local development foundation. Registration, invitations, password recovery, production HTTPS/secure-cookie configuration, hosting, operational cleanup and production abuse controls are not delivered. The static fixture uses fixed valid edges; editable DAG validation is Phase 02. No claim is made for risk detection, real AI reasoning, approval/audit or integration functionality. Formal accessibility auditing and production load testing remain later-phase work.

Next phase, only after approval: task editing and validated dependency engine. Runtime LLM and hosting selection remain open until their respective phases.
## Production-pack migration — 9 November 2026

User approved Supabase/Gemini/Vercel migration and free hosting. Dedicated Supabase project `iqsbbmwwayepeqwuxscg` is active; Vercel Hobby project `teamflow-guard` is created. Existing databases and legacy API are preserved.

Implemented routed dashboard/navigation, six-person labeled fixture, Supabase Auth and RLS, task create/edit/archive, dated availability, four deterministic risk detectors, bounded Gemini adapter, human-approved plan changes, durable receipts and append-only audit. Direct RPC validation rejects missing action fields/values and decisions. New migrations have been applied to the isolated hosted project.

Observed checks: 52 domain/structured-output tests, 33 disposable-database SQL checks, 70 legacy backend tests, lint/typecheck and production Next build all pass. Hosted Supabase browser flows pass at 1440x900 and 390x844, including task management, proposal deep-link reload, rejection preserving tasks, approval persistence and viewer denial. Screenshots are under evidence/supabase-*.png. SQL tests roll back; browser tests intentionally retain auditable demo decisions. Supabase advisor reports no RLS warning and one warning for disabled leaked-password protection.

Live Gemini is unverified because credentials are absent. Vercel deployment `dpl_CuCD8JUuKTQuRAg83MwiGnnbU1DG` is READY from source `f5c0fef` in Singapore. Canonical tested origin: https://teamflow-guard-sadib-dewans-projects.vercel.app. Hosted desktop/mobile workflows both passed (1.2m total); `/api/health` returned 200. The user approved a temporary Vercel share link for verification; ordinary deployment protection remains enabled. Unit/adapter coverage is now 59 tests. GitHub validation run 42610433451 passed all jobs, including Docker build/missing-credentials smoke checks. Production npm audit found zero vulnerabilities; the scoped runtime error/fatal log query returned no entries. Draft PR: https://github.com/SDAFIK/TeamFlow-Guard/pull/1. Broader pack gaps and reproducible seed instructions are recorded in docs/MIGRATION_RUNBOOK.md; do not describe the entire production pack as finished yet.

Hosted tablet flow at 768x1024 also passed (31.9 seconds), with no page overflow. Evidence screenshots for all three viewports are committed. No live Gemini response, competition recording, or complete larger-product rollout is claimed.

## Origin mismatch fix — 9 November 2026
The hosted login origin check accepted only APP_BASE_URL, rejecting the short production alias and unique deployment URLs. Added an exact configured alias allowlist plus the deployment's server-provided VERCEL_URL. No request Host header or wildcard is trusted. Added 15 regression cases; 74 unit tests, lint/typecheck and production build pass. Deployment dpl_GFB2117v9vawQv8U6Gey82LQAYQ9 is READY from 519487c. Hosted short-alias login/logout and foreign-origin denial passed at 1440 and 390 px (2 tests, 14.2s). GitHub CI run 42611588515 passed.

## Real workspace workflows - 10 November 2026

Implemented empty workspace creation, email-bound one-time invitation links (hash-only storage, seven-day expiry, revocation), owner-managed roles, editable workspace settings, saved workspace selection and visible-page refresh. Removed hardcoded DemoWorks and demo labels from real workspaces. Replay is demo-only. Settings changes invalidate old proposals; CI detection uses the current tracked branch.

The hosted workspace_management migration is applied. 45 disposable SQL checks, 75 unit tests, lint/typecheck and production build pass. Desktop/mobile browser flows passed against hosted Supabase: create workspace, persist settings/tasks, accept viewer invitation, and deny viewer writes. Fixed the mobile drawer remaining open after setup. No test emails were sent; invitation tokens remained private. Security advisor reports the existing leaked-password-protection warning only.

Hosted deployment e14c8b8 is READY on https://teamflow-guard.vercel.app. Desktop/mobile workspace flows passed on the hosted app (2 tests, 43.9s), including saved settings/tasks, invitation acceptance, and denied viewer writes. CI run 42700753408 passed all jobs. The initial hosted test timed out on an exact label locator for a prefilled textarea; using its accessible textbox name resolved the test issue. No deployed application error/fatal log entries were observed in the checked window. Registration/confirmation code is implemented, but actual email delivery and redirect allowlists are unverified: the connector lacks Auth configuration tools and browser setup failed. Gemini credentials, GitHub ingestion and history pagination remain outstanding.

## History browsing - 10 November 2026

Added bounded cursor pagination to the migrated audit API and an accessible history screen with Load older events, refresh, error/retry and end-of-history states. Current membership is checked server-side and reads retain RLS. Timestamp precision and UUID tie-breaking prevent skipped equal-time records; cursor validation rejects filter injection. Legacy audit behavior is preserved.

Observed: 78 unit tests pass; lint/typecheck pass. Desktop 1440px and mobile 390px persisted-history flows passed (2 tests, 50.6s), covering pagination, invalid cursor/limit, unavailable workspace denial and no horizontal overflow. Screenshots: evidence/history-desktop.png and evidence/history-mobile.png. Initial browser launch was blocked by sandbox permissions; after using authorized external browser execution and restarting the stopped local server, checks passed. The sandboxed build hit Windows EPERM on generated output; an unsandboxed build is being verified before release.

Gemini key/model presence checks remain false. Supabase Auth configuration remains inaccessible through browser creation (timeoutMs tool error); email confirmation is not claimed verified. GitHub ingestion is still outstanding in the migrated stack. The full pack is not complete.

Follow-up: the unsandboxed production build passed. Added operator-only GitHub CLI import using the existing login without copying credentials. Imported 16 actual completed TeamFlow validation runs into the existing hosted REL-106 mapping; two current workflow/branch streams remain active. Settings explicitly labels imported evidence as manual sync. Public webhooks and continuous automatic sync remain unconfigured. 48 disposable SQL checks pass, including duplicate attempts, safe SQL quoting, out-of-order checks and branch isolation; all test changes rolled back. No hosted plan or task fields were changed by the import.

Release verification: commit 6eb56d4 deployed READY as dpl_3maBLCkb2aVtkGmQsFWnYrLqxAZJ to https://teamflow-guard.vercel.app. Hosted desktop/mobile history and GitHub evidence tests both passed (26.4s); CI 42855258545 passed frontend, backend and Docker jobs. Final lint/typecheck/build passed. Gemini settings still absent at the latest presence-only check; user is saving the local environment configuration. No live model output is claimed.

## Gemini provider failure diagnosis - 10 November 2026

Reproduced the reported generic error with the user's configured Gemini model. A bounded fictional SDK request returned HTTP 503 / UNAVAILABLE with high-demand information for gemini-3.8-flash. One retry through localhost also returned 503; task data and plan version remained unchanged. No successful live Gemini proposal is claimed. Updated sanitized error mapping to distinguish provider unavailability, credentials/access, missing model and rejected request from invalid generated output; provider error text/secrets are never sent to the UI. 83 unit tests and two desktop/mobile browser regressions passed (22.1s). Full frontend checks are completing. The model and free-only constraints are unchanged.

Credential maintenance: user requested an owner demo password change; Supabase sign-in and localhost login returned success. Private per-account credential storage and fixture/test consumers now preserve the viewer's separate existing password. No credential values are recorded here or in source.

## First-run UX and task creation — 11 November 2026 (local working copy)

- Source: the newer TeamFlow Guard ZIP provided by the user through a Drive sharing link. The working copy excludes Git history, dependency installs, build output, local database data, login files and environment secrets. This working copy is **not deployed or pushed**.
- Added a premium first-visit screen with separate create/join actions, a data-backed real-workspace setup checklist, a responsive layout and reduced-motion behavior. An existing but unavailable workspace now shows retry guidance instead of falsely showing an empty-account welcome.
- Improved task creation with a suggested editable ID, standard form validation, clearer descriptions and a visible success confirmation after creation/edit/archive. The server continues to enforce key uniqueness and authorization.
- Baseline on extracted source: 88 unit tests passed, lint passed, TypeScript passed and production build passed.
- After onboarding: 92 unit tests passed, lint passed, TypeScript passed and production build passed.
- After task creation improvements: **95 unit tests passed**, ESLint passed and TypeScript passed; production build passed. No database schema or API change was required.
- Local Chromium could not start because the execution sandbox denied its socket; an escalation request was also rejected. **Desktop/mobile visual browser QA and hosted end-to-end persistence remain unverified in this work environment.** The temporary visual QA route was removed before packaging.
- No hosted Supabase data, Gemini model, GitHub branch, Vercel deployment or other remote service was modified.

Next: manually review the new layouts at 1440px/390px and run a fresh-workspace scenario on an isolated development project, then continue the broader UX and provider reliability gates in `docs/PRODUCT_UX_RELEASE_PLAN.md`.
