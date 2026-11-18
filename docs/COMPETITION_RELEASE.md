# Competition release checklist

> **Historical release-gate document (archived):** This checklist describes the pre-release candidate and is preserved for engineering traceability. The current public release is live. For verified submission links and current limitations, see [SUBMISSION.md](../SUBMISSION.md) and [DEMO.md](../DEMO.md). Do not treat the historical “blocked” or “candidate” statements below as current status.


## Candidate and evidence

Stages 1–4: workspace lifecycle, private six-person demo, premium responsive UI/motion, full authenticated local acceptance. Candidate baseline: 599f5c79fd74b115fab04318eccd859dee6842be.

- [Regression](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43648885029): passed.
- [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43648885010): passed (real local Auth/PostgreSQL; controlled GitHub and Gemini transport fixtures).
- [Responsive evidence](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43647711283): passed automated route sweep; review screenshot artifact manually.
- Hosted email confirmation, actual external providers and live candidate browser acceptance remain release gates.

## Database preflight (read-only before approval)

Hosted TeamFlow project iqsbbmwwayepeqwuxscg has nine baseline migrations. Their timestamps differ from repository filenames; compare actual definitions and schema, not timestamps alone. Do not blindly run db push, repair migration history, reset, seed or modify existing workspaces. New candidate files:
- supabase/migrations/20261114214305_workspace_lifecycle.sql
- supabase/migrations/20261114215430_isolated_demo_team.sql

Review current schema, role grants, RLS, foreign keys and production compatibility. Confirm recovery/backup procedure before applying exactly the two pending reviewed migrations in order. These are schema changes; preserve existing production rows and Auth accounts. The personal-demo migration changes the membership Auth foreign key to a generated Auth-only reference and introduces fictional non-login identities; verify existing memberships and constraints. Never seed or delete existing real data for acceptance.

## Release order

1. Validate the exact release branch/PR against current main; check CI and all screenshots.
2. Confirm the intended Vercel project and production deployment rollback identifier; inspect preview environment without exposing secrets. Do not point a preview at real data for mutating tests.
3. Approve and apply only reviewed schema migrations after preflight; verify schema and security. Existing app should remain compatible while schema is deployed. If any step fails, stop; do not blindly reverse schema or reset data.
4. Stage a production build without assigning the public domain, validate against the intended configuration using dedicated isolated test identities/workspace, then promote only the tested build. If this capability is unavailable, retain current production until equivalent gated release is arranged.
5. Verify actual sign-in, email confirmation/resend, workspace join, six-person personal demo, reset, actual Gemini response and signed GitHub CI/review evidence in dedicated test fixtures only. No real repository writes from AI. Do not claim fixture tests are genuine hosted calls.
6. Verify desktop/mobile screenshots, keyboard focus, reduced motion, task/graph/dialog interaction and error states. Verify live health and deployment SHA; inspect runtime errors and rollback app if needed.
7. Competition rehearsal: open private demo, inspect AUTH-142, trace downstream tasks, compare rules/Gemini, approve one proposal, verify plan and audit, replay CI success, reset for next judge. Real prediction disabled; synthetic model metrics are not real-world accuracy.

## Release status

Candidate passes local acceptance. Production release remains blocked until hosted database migration/verification, actual hosted provider checks, visual review and deployment promotion are documented. No paid services or existing production data changes authorized by this checklist.
