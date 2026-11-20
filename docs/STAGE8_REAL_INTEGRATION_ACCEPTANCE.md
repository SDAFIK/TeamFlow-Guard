# Stage 8 — Real external integration acceptance

**Audit baseline:** 2026-11-20. **Updated with verified historical production records on 2026-11-20. Status: AUTOMATED SAFETY COVERAGE PRESENT; PARTIAL HISTORICAL PROVIDER EVIDENCE; EXTERNAL ACCEPTANCE NOT YET CERTIFIED.**

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

## Supplemental read-only historical evidence (20 November 2026)

A second, narrowly scoped read-only review of non-demo evidence and matching public GitHub run records found **real past CI activity** missed by the first audit. This is a correction of the earlier claim that no live CI webhook evidence was observed; it **does not** certify the six Stage 8 gates, imply a new production test, or verify GitHub's delivery receipt.

- **GitHub Actions:** the non-demo evidence record for [CI failure 43324373557](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43324373557) has `origin=github`, `ingestion=github-app-webhook`, and a matching run ID, branch (`codex/github-live-sandbox`), conclusion, and timestamp. A subsequent [successful run 43324780151](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43324780151) also matches persisted non-demo CI-pass evidence. The failure is inactive, the pass is active. We did **not** inspect an independent GitHub App delivery receipt, replay a signed delivery, prove webhook idempotency in a new real scenario, or use a newly dedicated sandbox repository.
- **Gemini:** hosted production records include four completed demo-workspace analyses for model `gemini-3.1-flash-lite`; all four record token-usage metadata and link to four Gemini-sourced proposals, three approved. Recorded latencies range 1,335–1,838 ms. These are strong historical application-side signals of provider usage, **not** a provider-console receipt or independent validation of a fresh model response/quota. They came from fictional demo workspaces, not real customer data.
- **Hosted invitations/team:** four non-demo invitations have recorded acceptance; non-demo workspaces include more than one authenticated member account. This supports that hosted collaboration occurred. It does **not** show the original email reached a recipient inbox, verify every approval/permission case, or demonstrate outsider denial.
- **GitHub review deliveries:** the production `teamflow_private.tf_review_deliveries` count was zero at this audit; no independently verified real GitHub review submission/reconciliation is established.
- **Dedicated test isolation:** the connected GitHub account lists no separate TeamFlow CI sandbox repository, and the connected Supabase account lists no standalone active staging project. We did not create either or invoke any paid service. Prior live CI history used an isolated branch of the primary repository.
- **Connected email mailbox:** a targeted read-only Gmail search did not find a TeamFlow Guard invitation in the connected mailbox. This neither proves nor disproves delivery to other recipients.

All findings were obtained without reading secret values, external email contents, production invitation tokens, or private workspace descriptions, and without mutating production data. GitHub run links are public-source corroboration; database origin tags alone are not independent webhook-signature receipts.

## Current evidence by gate

| Acceptance gate | Local automated coverage | Real-world evidence needed | Status |
| --- | --- | --- | --- |
| Hosted signup, confirm, resend, recover | `scripts/workspace-lifecycle-e2e.cjs` uses disposable local Supabase and Mailpit | Actual hosted test-account confirmation/resend/recovery delivery to a test inbox and safe redirect; delete test account afterwards | BLOCKED — not observed in this audit |
| Real Gemini response | `web/server/gemini.test.ts` and `scripts/stage8-auth-e2e.cjs` cover structured response, quota, error and intercepted transport | Verify historical completed demo analyses against provider-side logs, structured response and quota; use a bounded newly authorized test call only if needed | PARTIAL — four completed hosted analyses with usage metadata; provider-side proof pending |
| Real GitHub CI delivery | `web/server/github-webhook-route.test.ts` and `scripts/stage8-auth-e2e.cjs` cover signed fixtures and persistence | Independently review delivery receipts/signature and idempotency in authorized isolated sandbox, including fail, duplicate and pass | PARTIAL — two real public GH CI runs correlate with non-demo persisted github-app-webhook evidence; delivery receipt missing |
| Real GitHub PR-review delivery | Local signed review-submission fixture and reconciliation | Genuine eligible reviewer submission, observed signed webhook and risk resolution in isolated workspace | BLOCKED — no real review delivery observed; stored review-delivery count zero |
| Actual invitation inbox delivery | `web/server/invitation-email.test.ts`, `web/server/gmail-smtp.test.ts` cover provider behavior | Consent-based email to a dedicated test inbox; verify recipient receipt and safe invitation acceptance/expiration | PARTIAL — hosted invitation acceptance exists; independent inbox delivery not verified |
| Hosted multi-user / outsider denial | Authenticated local browser suite tests permissions and isolated owner/member/outsider | Dedicated hosted staging workspace with non-production accounts; authentic session, cross-tenant denial, versioned approval and persisted audit | PARTIAL — non-demo multi-member use observed; isolated outsider-denial acceptance not verified |

The production system **is deployed**, and a few historical real provider activities are corroborated. However **none of the six full external acceptance gates is independently signed off**. Blocked or partial status does not imply features are absent, nor does recorded app-side telemetry alone prove end-to-end delivery.

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
