# Stages 9–12 — Competition release readiness and explicit acceptance boundaries

**Audit date:** 20 November 2026  
**Release goal:** stable, responsibly labeled competition demo; production data, secrets and paid services remain untouched.  
**Important distinction:** a working competition demonstration is not independently certified external integration, security/backup restoration, or a real-customer pilot.

## Stage 9 — Security and operational reliability

**Engineering changes in this release:** explicit strict TypeScript typechecking in normal GitHub CI; existing backend/SQL/RLS, unit, Docker, and authenticated disposable-local-Supabase tests remain required; event evidence and secrets are never printed into public release artifacts. A written security decision log is included here. No schema or auth configuration changed.

**Read-only Supabase security advisor snapshot:**
- `auth_leaked_password_protection` WARN: compromised-password protection was not enabled at audit. The account owner must evaluate and enable this in Supabase Auth settings, subject to their plan/availability; do not claim it is active.
- Anonymous-sign-in advisories for 10 public TeamFlow tables (guest functionality is intentional). Sampled read policies use workspace membership lookup (`teamflow_private.member_role(workspace_id)`), but this is **not** proof of full RLS safety; deliberate authenticated/guest/cross-tenant allow/deny testing remains required.
- Six private tables show `rls_enabled_no_policy` INFO, potentially intentional for service-only RPC access; do **not** add public read policies simply to remove warnings.
- Performance advisor identified 17 uncovered foreign keys and one private guest-budget table lacking a primary key. These are planning recommendations, not a measured outage. Index design and any migration require analysis of constraints, query plans, lock impact and rollback on a **disposable** database before production consideration.
- Existing signed webhook route validates a bounded raw body and SHA-256 HMAC before mapping. Unmapped signed events may return HTTP 204; this is a **received-but-ignored** event, not a linked risk.
- Backup **restore drill** and incident/rollback rehearsal have **not** been independently observed. Check actual plan backup entitlements; never assume Vercel deployments are database backups.

**Residual go/no-go:** production code critical CI tests must pass; do not represent this release as fully security audited, penetration tested, restore verified or enterprise compliant.

**Safe next operational actions:** export the documented non-secret schema and restore procedure on separate temporary infrastructure; independently review RLS for guest/member/viewer/manager/outsider; inspect live rate-limit/error and AI fallback metrics; address leaked-password setting and index recommendations only after cost/impact review.

## Stage 10 — UX, accessibility and performance

**Engineering changes in this release:** accessible visible-on-focus **Skip to main content** link on the shared app layout with matching main targets on dashboard, login and password-reset screens. Browser smoke includes keyboard skip-link focus/Enter, reduced-motion browser setting, no-overflow/page-error checks, manager/viewer roles, and desktop 1440px, tablet 768px, mobile 390px.

Automated Playwright smoke uses **intercepted/simulated API**, not production accounts. It checks user-facing actions, but is not a third-party WCAG audit or measured production p95 benchmark.

**Unverified:** touch-device testing, full screen-reader audit, live production web-vitals on real networks, concurrency/load and performance regression baselines. Never invent Lighthouse scores or call this “WCAG certified.”

## Stage 11 — Real-team pilot and customer readiness

The shipped guest demonstration and historical hosted workspace invitations support **demo readiness**. An independently observed multi-user *real-team pilot* with consent, usability notes, issue resolution, documented retention/deletion and customer support is **not complete**. It would be misleading to relabel fictional guest/team events as a pilot.

**Safe pilot protocol (post-submission):**
1. Recruit a few consenting small software teams; confirm privacy/data use terms and avoid confidential production repo data.
2. Self-onboard using an isolated test project; add two authorized members and a viewer; verify invitations, permission denial and browser navigation.
3. Observe baseline planning, a failing tracked CI, dependency cascade, proposed recovery, lead approval, later passing CI and audit.
4. Record anonymized issues and qualitative feedback, not invented conversion percentages or performance numbers.
5. Remediate critical bugs; independently repeat the test and document consent/retention. Do not launch paid billing or mass onboarding while the hosted security gate is open.

**Status:** pilot plan prepared, **external participation unverified**.

## Stage 12 — Stable competition submission release

**Completed artifact scope after CI validation and promotion:** public web app, GitHub source, complete [SUBMISSION.md](../SUBMISSION.md), [DEMO.md](../DEMO.md), code-linked architecture, explicit acceptance caveats, keyboard accessibility improvements, and a versioned GitHub release record. The release may be titled **competition demo/release candidate**; do not claim enterprise general availability.

**Release is blocked by** lint/typecheck, Vitest, backend and RLS tests, Docker, browser smoke, failed production build, unhealthy live health endpoint, or unexpected runtime errors. Post-merge GitHub commit and Vercel alias must match before declaring that new production code is live.

**Competition portal submission is an external action and is NOT complete until portal confirmation is independently observed.** The actual video recording/link and form confirmation cannot be inferred from an outline.

### Test source and what it proves

| Source | Claims supported | Not established |
| --- | --- | --- |
| GitHub `validation.yml` | Lint, explicit TS checks, unit, Docker/backend, simulated Playwright | Third-party provider receipt; actual users |
| Isolated authenticated local Supabase acceptance | Auth email via Mailpit, workspace permissions, approvals, fixture webhooks | Production inbox, live provider quota or hosted outsider rejection |
| Historical hosting/Supabase telemetry | Specific past Gemini usage, accepted invites and github-origin CI evidence | All external provider delivery guarantees |
| GitHub App Advanced Recent Deliveries | Signed request to TeamFlow endpoint with 204 response for review request | Ingestion of mapped CI or review evidence |
| Public judge demo | Judges can experience actual app using fictional seeded data | Real employee risk accuracy, commercial customer pilot |

### Submission decision

**Eligible for transparent competition demo submission once post-merge CI and live smoke pass.** Keep Stage 8 external-provider acceptance [issue #45](https://github.com/SDAFIK/TeamFlow-Guard/issues/45) open; do not claim its pending gates complete. A real user pilot, backup/restore test and portal/video confirmation are separate obligations.

### Manual final judge-day checklist

- [ ] Production domain resolves to expected release commit, `/login` and `/api/health` return HTTP 200
- [ ] Guest demo opens without account, main risk/approval/audit journey works, deterministic fallback works without Gemini
- [ ] Public source README/SUBMISSION/DEMO are updated; check release and CI links
- [ ] Record & upload an actual 4-minute product walkthrough and verify video visibility
- [ ] Confirm competition entry rules, date and category; enter team/eligibility details
- [ ] Submit final entry in competition portal and save confirmation
- [ ] Schedule post-competition real integration, restore and pilot follow-up without jeopardizing the stable demo

**Policy:** no fake user testimony, simulated provider traffic described as live, external email receipt claims, benchmark numbers without measurements, or “100% production ready” statements.
