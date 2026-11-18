# V1.1 native competition demo release gates

> **Historical release-gate document (archived):** This checklist describes the pre-release candidate and is preserved for engineering traceability. The current public release is live. For verified submission links and current limitations, see [SUBMISSION.md](../SUBMISSION.md) and [DEMO.md](../DEMO.md). Do not treat the historical “blocked” or “candidate” statements below as current status.


## Experience
Login page → Enter Live Demo — No Sign-up → native anonymous Supabase Auth session → existing `tf_personal_demo` → actual /overview, TIC Intelligence, Risk Center, dependencies, tasks, decisions, team, audit and settings. The independent /demo sandbox prototype is removed. The optional guide is in the shared workspace; no duplicate UI or AI engine.

- One isolated fictional workspace per identity; no real project create/join/invites. Anonymous role is not equivalent to permanent verified identity. Database guards check auth.users.is_anonymous and ownership, not editable user metadata.
- Two-hour guest access; three actual Gemini reservations per identity, independent of reset. Global guest signup and Gemini reservation caps; no paid service or secrets in browser. Provider limits still apply; rule-based recovery and TIC remain available. Normal registered users retain their previous behavior.
- Guest identity/fictional records are retained after expiry pending a separately reviewed maintenance procedure. A cap prevents unlimited anonymous accounts. Do not bulk delete Auth or workspaces.
- For old email resend implementations, Auth may verify the address and redirect with an implicit fragment. The app never trusts fragment tokens; it asks the user to sign in. The browser strips the fragment. PKCE recovery uses the pinned SDK's verified recovery discriminator and a session-bound, HTTP-only marker.

## Deployment gates
1. Confirm exact PR #27 head: standard CI, full authenticated acceptance with local Mailpit signup/resend/password reset, native guest + real workspace TIC and intercepted Gemini provider tests, SQL isolation/expiry/reset quota. Inspect actual guest desktop/mobile screenshots.
2. Read-only hosted schema preflight, then apply only `supabase/migrations/20261115000408_competition_guest_access.sql` after all tests pass; compare existing workspace/member counts and fingerprints; verify grants and security. Do not run a broad db push or reset. This migration is additive except for guarded function replacements.
3. In the hosted Supabase Auth provider configuration, enable anonymous sign-ins only after those isolation guards are installed. Review Auth rate limits / abuse mitigation. In Vercel production environment set `TEAMFLOW_PUBLIC_DEMO_ENABLED=true` only after the DB guard is installed. No new service-role or provider secrets are needed. If disabled, the endpoint returns a safe 503 and verified-account demo remains available.
4. Stage production-target build without assigning the public domain. Test one-click guest on two separate browser sessions, actual TIC model controls, actual Gemini call/approval, reset/quota, exit, mobile, and no access to existing private data. Real Gemini usage must be measured, not inferred from fixture tests.
5. Verify fresh hosted registration/confirmation/resend and password reset using a dedicated test mailbox and new fixture account. Verify real GitHub review lifecycle in the dedicated integration workspace only. Existing GitHub CI evidence is not proof of new real review ingestion.
6. Merge exact tested candidate and promote staged build only after hosted checks; verify public domain, health, guest entry and runtime logs. Existing public version is the rollback target. No existing workspace or real user records may be deleted.

## Current status
Implementation and tests added; final CI and hosted gates pending. No production change authorized by this file alone.
