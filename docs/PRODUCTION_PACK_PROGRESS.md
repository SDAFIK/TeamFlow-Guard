# Production pack migration — 9 November 2026

All 12 supplied documents read and archived unchanged in production-pack/. Baseline a105dd0 was clean. Work branch: codex/production-pack-migration.

User explicitly approved Supabase Auth/Postgres + Gemini + Vercel, superseding FastAPI/OpenAI/Render/Neon for the new release. Preserve legacy implementation and development data until verified. Free tiers only; no upgrades. Account connections and Gemini credentials are external prerequisites.

Architecture: Next.js route handlers authenticate through Supabase; RLS scopes reads; private authorized PostgreSQL functions transact mutations and append audits. Gemini receives bounded evidence and proposes only; a manager approves revalidated changes. No service-role key in browser/runtime.

Screen tree: /login, /overview, /risks, /tasks, /dependencies, /decisions, /capacity, /audit, /settings. Preserve navy/teal shell, mobile menu, graph/list and review dialogs. Navigation must survive reload and Back.

## Sequence and proof required
- [x] Routed shell, desktop/mobile screenshots and browser tests.
- [x] Supabase schema, six-member fixture, roles and RLS isolation tests.
- [x] Task/dependency mutations and four evidence-grounded risk detectors.
- [x] Gemini schema validation, bounds, idempotency and fallback.
- [ ] Atomic approval, rejection, audit, stale/concurrent/role-denied tests.
- [ ] Demo reset, quality gates and competition evidence.
- [ ] Connected free hosting, live AI and deployed smoke tests.

Top risks: tenant isolation regression; duplicate/partial approvals; fixture/live confusion; unavailable provider credentials; broken UI contracts during migration. No deployed or live Gemini claim yet. The pack's pasted Phase-00-only prompt is reference text and does not override the current implementation request.

Verified 59 unit tests (40 detector cases and 19 graph/model/adapter checks), 33 SQL authorization/transaction checks, and 70 preserved backend tests. Desktop/mobile browser flows passed against hosted Supabase. Deployment f5c0fef is READY on Vercel in Singapore; hosted desktop/mobile workflows and health checks pass. CI run 42610433451 is green. Live Gemini remains unverified. See MIGRATION_RUNBOOK.md for explicit larger-product gaps.
