# Stage 8 — Real external integration acceptance

**Audit baseline:** 2026-11-20. **Status: AUTOMATED SAFETY COVERAGE PRESENT; EXTERNAL ACCEPTANCE NOT YET CERTIFIED.**

This checklist intentionally distinguishes **configured**, **local fixture tested**, and **verified with a real external provider**. Build success, environment variable presence, GitHub API read-only visibility and intercepted provider tests are *not* proof of genuine event delivery. Stage 8 cannot be declared entirely finished until the separately reviewed evidence below exists.

## Read-only production snapshot (20 November 2026)

- Production deployment is active on `teamflow-guard.vercel.app`, and `/api/health` returned HTTP 200 in the previous Stage 7 release acceptance.
- Connected Supabase project named **TeamFlow Guard** reported `ACTIVE_HEALTHY`; no live data was edited during this audit.
- Vercel **variable-name-only** inventory (no secret values fetched or printed) shows server configuration entries for Gemini, GitHub App signing/ingestion and Gmail invitation transport. It does **not** establish that any test message, webhook or Gemini request succeeded.
- The external GitHub App has not been installed on a dedicated acceptance repository through this audit. Existing GitHub connector authorization in ChatGPT is not the same as TeamFlow's webhook installation.
- No isolated hosted test Supabase project is currently identified in the connected account (only the TeamFlow project and an unrelated inactive project). **Do not perform tests against existing production user data.**
- Supabase Security Advisor reports guest/anonymous-policy warnings, RLS-on-private-table informational findings and an Auth leaked-password-protection warning. Read-only inspection of sampled public read policies found membership checks via `teamflow_private.member_role(workspace_id)`; this is not proof of an exploitable leak or a complete RLS review.
- Supabase Performance Advisor reports index recommendations. These belong to Stage 9 security and reliability review; do not apply speculative schema migrations to production for Stage 8.

Security reference: https://supabase.com/docs/guides/database/database-advisors
Password security reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Current evidence by gate

| Acceptance gate | Local automated coverage | Real-world evidence needed | Status |
| --- | --- | --- | --- |
| Hosted signup, confirm, resend, recover | `scripts/workspace-lifecycle-e2e.cjs` uses disposable local Supabase and Mailpit | Actual hosted test-account confirmation/resend/recovery delivery to a test inbox and safe redirect; delete test account afterwards | BLOCKED — not observed in this audit |
| Real Gemini response | `web/server/gemini.test.ts` and `scripts/stage8-auth-e2e.cjs` cover structured response, quota, error and intercepted transport | A bounded, explicitly authorized call with a correctly grounded structured response, a provider request ID/status, with no billable use without approval | BLOCKED — no live request observed in this audit |
| Real GitHub CI delivery | `web/server/github-webhook-route.test.ts` and `scripts/stage8-auth-e2e.cjs` cover signed fixtures and persistence | Sandbox repository + TeamFlow App installation; actual GitHub delivery for fail/duplicate/success, recorded task/evidence state; no production workspace | BLOCKED — no sandbox App delivery observed |
| Real GitHub PR-review delivery | Local signed review-submission fixture and reconciliation | Genuine eligible reviewer submission, observed signed webhook and risk resolution in isolated workspace | BLOCKED — no live review submitted |
| Actual invitation inbox delivery | `web/server/invitation-email.test.ts`, `web/server/gmail-smtp.test.ts` cover provider behavior | Consent-based email to a dedicated test inbox; verify recipient receipt and safe invitation acceptance/expiration | BLOCKED — no external inbox receipt observed |
| Hosted multi-user / outsider denial | Authenticated local browser suite tests permissions and isolated owner/member/outsider | Dedicated hosted staging workspace with non-production accounts; authentic session, cross-tenant denial, versioned approval and persisted audit | BLOCKED — no hosted isolation acceptance run observed |

The production system **is deployed**, and these blocked observations do **not** mean the corresponding software features are absent. They mean **real external acceptance has not been independently demonstrated for this stage**.

## Repeatable validation command

`node --test scripts/stage8-acceptance-gate.test.cjs` runs offline and must pass in normal CI. It proves that fixture/mock evidence cannot accidentally certify live acceptance.

`node scripts/stage8-acceptance-gate.cjs` prints `PENDING` for each gate and exits nonzero intentionally. It makes no provider requests, reads no secrets and creates no users.

Optional local manifest `stage8-evidence.local.json` (NEVER commit; keep outside the repository, e.g. in a secure local folder):
```json
{
  "checks": [
    {
      "id": "github-ci",
      "source": "github-delivery",
      "evidenceRef": "recorded-external-github-event-ID",
      "observedAt": "2026-11-20T00:00:00Z",
      "result": "observed"
    }
  ]
}
```

Use `node scripts/stage8-acceptance-gate.cjs --evidence /private/path/stage8-evidence.local.json`. Even with every reference recorded, the result is `REVIEW_REQUIRED`, **not** automatically certified. Do not insert real email addresses, tokens, webhook raw bodies, project secrets, cookies, URLs with credentials, or private user data into evidence manifests or CI artifacts.

## Exact path to full Stage 8 acceptance

1. In a disposable checkout, run existing local Auth + Mailpit and signed webhook acceptance (the current CI already does this on a temporary database). Confirm exit code and sanitized log artifacts.
2. Have the owner authorize **a dedicated non-production GitHub sandbox repository and temporary App installation**, and use a local or isolated staging workspace. Do not bind TeamFlow's production project. Follow `docs/STAGE_1_2_LIVE_GITHUB_ACCEPTANCE.md`. Capture actual GitHub delivery status and IDs outside Git.
3. For PR reviews, add **Pull request review** to App subscriptions and use a consenting test reviewer. Confirm submission → accepted delivery → risk resolution. Do not infer review completion from a comment.
4. For external email, use a dedicated inbox and explicit consent. Test Auth confirmation/resend/recovery and one invited teammate independently. No real customer email or existing invitation records.
5. For Gemini, confirm the selected model and quota in the owner's provider console. With approval for any potential usage cost, make a single bounded request using synthetic evidence, verify structured output and server-side validation; separately test an unavailable/429 fallback. Do not leak an API key or raw private data.
6. Perform two-user/outsider acceptance only in an **isolated hosted test project**, with clean test workspaces and documented cleanup.
7. Independently review recorded evidence, execute relevant CI/Playwright suites and check the production build without touching real user data. Mark Stage 8 fully accepted only after all six gates are reviewed.

## Known external dependencies

The project owner needs to authorize or provide: a GitHub test App/repository with the right event subscriptions, a non-production environment, test mailboxes, and permission for one bounded live Gemini request if it cannot be established free of charge. Do not silently create paid Supabase branches or production test records. If these prerequisites are unavailable, record `BLOCKED` rather than simulate success.

**Security:** no secrets were read, printed, shared, committed or changed in this audit. Do not use live production customer accounts to complete missing tests.
