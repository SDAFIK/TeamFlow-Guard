# Stage 4 no-cost staging and release gate

This document is a reproducible validation path **without paid Supabase branching**. The disposable GitHub Actions database is the primary no-cost staging environment. Neither the TeamFlow Guard production Supabase project nor its live Vercel alias is modified by these tests.

## Test environment and exact commands

GitHub Actions workflow `.github/workflows/validation.yml` runs Node.js 24, a PostgreSQL 18 container, and the existing Python SQL harness. The workflow executes `python scripts/test-supabase.py` in the repository root after backend setup. That harness **refuses** any database host outside `localhost` / `127.0.0.1`, and any database name other than `teamflow_test` or `teamflow_test_utf8`. It applies all `supabase/migrations/*.sql` inside one transaction, exercises RPC behavior and then rolls it back.

To reproduce on Windows without a cloud bill, clone the Stage 4 branch and run the GitHub Actions workflow, or use a dedicated local PostgreSQL 18 test database with the existing project bootstrap scripts. Inspect `api/ci_setup.py`, `api/setup_local.py`, `api/requirements.lock.txt` and `scripts/test-supabase.py` before local execution. **Never** point the test harness to the hosted Supabase database.

The test scripts verify owner/manager/member/viewer/outsider permissions, read and write isolation, invitation redemption, and, for Stage 4, authorized public-repository link/unlink, version conflicts and audit history. GitHub repository discovery itself is tested via mocked responses in `web/server/github-public.test.ts`; it is not private-repository OAuth or a true GitHub-to-Supabase end-to-end test.

## Frontend verification

```powershell
cd web
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

Mock-browser regression tests exist at `scripts/ux-smoke.cjs`. They are not equivalent to an authenticated Supabase browser test. Browser acceptance at 1440px desktop and 390px mobile remains a release gate. Test keyboard selection and zoom/pan on the dependency graph, empty and cyclic-data displays, readable minimap/legend, invitation draft and accept, repository errors/rate limits, team roles, and mobile overflow. Run only against disposable identities/data.

## Deployment order (not yet authorized by these checks)

1. Require passing Stage 4 GitHub Actions on the exact PR head and a reviewed migration.
2. Run desktop/mobile authenticated acceptance with the actual app and a **separate** test backend, not production.
3. Apply the reviewed `20261111184927_github_connections.sql` migration to production only after explicit release approval and backup/rollback planning. Verify RPC privileges and schema, and rerun security advisors.
4. Merge PR #3 after staging passes. Deploy the exact merge commit to the **existing** Vercel project, preserving its HTTPS alias, environment and access controls.
5. Verify health, authenticated workspace list, invitation acceptance with two distinct accounts, repository linking, dependency graph and Vercel runtime errors. Roll back web deployment if runtime checks fail; schema changes need a separate compatible rollback plan.

**Not completed by CI:** real mail delivery (Stage 4 only prepares a mail draft), private GitHub OAuth, real two-user browser sessions, staging backend deployment, or production release.
