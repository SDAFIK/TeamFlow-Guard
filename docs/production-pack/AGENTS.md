# AGENTS.md — TeamFlow Guard Repository Rules

## Mission and source of truth

Build an evidence-grounded delivery-risk assistant with four risk detectors and human-approved recovery decisions. Read `README_START_HERE.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE_AND_DATA.md`, `AI_IMPLEMENTATION.md`, `QUALITY_GATES.md` and `PLANS.md` before any major implementation. Treat previous useful repository code as user-owned and preserve it. If documents conflict, explicitly report the conflict and ask or choose the conservative behavior, recording the decision.

## Agent operating agreement

1. **Inspect before changes.** Start with read-only repository inventory, git status, package/tooling and existing tests. Never overwrite unrelated work.
2. **Spec → preview → code → test → screenshot → report.** Before a UI phase, describe the screen tree and expected interaction outcome. Refer to `design/reference/` when available.
3. **Do one `PLANS.md` phase at a time.** Do not jump ahead or mark a phase complete based only on code generation. A phase ends with running verification and a concise evidence report.
4. **Prove functionality.** Never use pretend buttons, fake requests or hardcoded success to claim implemented functionality. Seeding explicit demo data is acceptable only with visible demo labeling.
5. **Human approval is mandatory.** LLM output cannot apply changes. Approved actions must be allowlisted, authorized, validated, idempotent and audited. External GitHub writes are out of scope by default.
6. **Defend data boundaries.** Scope all persisted records by workspace. Use Supabase Auth and tested Postgres RLS policies; server secrets never reach the client. Never commit `.env.local` or credentials.
7. **AI is a proposer, not a source of truth.** Deterministic rules compute risk facts and graph impact; the model receives only necessary grounded evidence and emits schema-validated proposals. Avoid prompt injection from task, PR or CI text.
8. **Check current package docs.** Choose currently compatible stable versions, use lockfiles and document selected model/provider. Do not make unsupported free-tier or model guarantees.
9. **Keep a clean repository.** TypeScript strict mode, modular functions, no unneeded packages, small commits, no credential logging. Use clear names and tests close to behavior.
10. **Do not deploy/publish without authorization and configured credentials.** Can prepare deployment configs and verification, then request the actual needed user action. Never circumvent access blockers.

## Technical conventions

- Stack: Next.js App Router + TypeScript, Tailwind + shadcn/ui, React Flow, Supabase Auth/Postgres, Zod, a server-only AI provider adapter, Vitest, Playwright.
- Avoid a second backend process or queue for the MVP. If webhooks require durable retries, design a small idempotent inbox table before adding infrastructure.
- Application logic lives in modules (`src/domain`, `src/server`, `src/features`); route components should not contain risk algorithms.
- Use SQL migrations plus RLS policy tests. No schema change solely in a dashboard without a migration.
- Every important action has a success state, rejection/validation path, loading state and error state.
- All user-visible timestamps use clear timezone labeling; persist UTC timestamps.
- Build in English, leave localization hooks; Bangla can be a follow-up, but no fake translation toggle.

## Minimum commands at each phase

Run what exists for the repository (or establish equivalents): `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and affected `npx playwright test` specs. If a command cannot run, record why and what evidence remains missing.

## Required progress report format

1. Phase and goal
2. Files changed
3. Working behavior demonstrated
4. Test commands, exit status, browser screenshots / reproduction steps
5. Simulated vs real data/integrations
6. Known gaps and next phase
7. Any user decision/credential/permission needed

Do not say "fully production ready" based on green compilation alone.
