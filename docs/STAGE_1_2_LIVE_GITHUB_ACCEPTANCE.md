# Stage 1.2 — isolated live GitHub App acceptance

Status: configuration required; not live-validated. No production writes or paid resources.

## Observed baseline
PR 13 head 9c35a506ba6eae644677206e085c08afe734efd6, validation run 43277122139 succeeded. Its workflow ID is 411004729, repository ID 1450114794, branch codex/teamflow-intelligence-core. These identify the development repository, NOT the dedicated acceptance repository. Do not bind production workspaces to this run.
Existing connector installation is not TeamFlow's own App and does not list workflow_run subscription. Visible Vercel environment inventory contains no GitHub App or ingestion configuration. No dedicated hosted TeamFlow staging database was found.

## 1. Dedicated test repository
Create a public repository containing only fictional test data, e.g. SDAFIK/teamflow-ci-sandbox (if available). No private source or credentials. Copy docs/fixtures/github-ci-sandbox.yml into .github/workflows/teamflow-ci-sandbox.yml in that repository. Enable Actions within free usage. Run once with outcome=fail and then outcome=pass on the same tracked branch. Capture actual immutable repository/workflow/run IDs from GitHub's API; do not guess them. The workflow never deploys anything.

## 2. Disposable local environment
Use Docker Desktop and the Supabase CLI locally; do not link or reset the hosted project. Start an independent local Supabase stack in a disposable checkout, apply the repo migrations there, and use local credentials. Start Next.js with TEAMFLOW_BACKEND=supabase, local NEXT_PUBLIC_SUPABASE_URL and publishable key, and a local APP_BASE_URL / APP_ALLOWED_ORIGINS. Create two fictional confirmed local Auth users, a non-demo workspace (the ingestion RPC rejects demo workspaces), a mapped CI task and an unfinished dependent task. Record baseline plan version and task fields. Do not copy production data. Use local mail capture for auth if needed.

## 3. GitHub App
In GitHub Developer settings create a dedicated test App, only on this account. Repository permissions: Metadata read, Actions read, Pull requests read. Subscribe to Workflow run and Pull request. Install only on the sandbox repository. Generate a private key and strong webhook secret; keep both outside Git and chat. For actual webhook delivery use an approved, temporary free HTTPS tunnel to the local receiver only; do not expose Supabase, database or unrelated ports. Configure URL <tunnel>/api/github/webhook. Do not weaken production Vercel protection. If no safe free tunnel is available, stop and use the isolated signed replay as a preflight, not live acceptance.
Set server-only GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_WEBHOOK_SECRET, TEAMFLOW_GITHUB_APP_BINDINGS and TEAMFLOW_GITHUB_CI_MAPPINGS. Set TEAMFLOW_GITHUB_INGEST_KEY to local service-role credential only. Bind exact sandbox repo ID, installation ID, workspace UUID, workflow ID and task UUID. Never expose private key or service role to browser. Restart local application.

## 4. Live acceptance
- App readiness reports authorized repository, credentials, webhook, ingestion and mapping. Verify real GitHub API activity and actual delivery receipt.
- Dispatch fail workflow on tracked branch. Verify GitHub delivery 202, one active ci_failure with real run URL, correct task and affected successor in Risk Center. Compare baseline plan version and task fields.
- Redeliver exact event: no duplicate evidence or task mutation.
- Dispatch pass workflow on same branch after failure: active ci_pass, previous risk resolves; no plan mutation.
- Redeliver older failure: must not reactivate current risk. Dispatch on unrelated branch: ignored.
- Check wrong signature returns 401, unauthorized installation ignored, viewer cannot approve, outsider cannot see workspace.
- Capture run IDs, delivery IDs/status, evidence IDs, before/after plan version and screenshots. Do not record secrets or invitation tokens.
- Shut down tunnel and revoke temporary test App installation/credentials when finished. Preserve only sanitized evidence.

## Gate
Stage 1.2 passes only after actual GitHub-originated delivery and local database persistence + authenticated risk UI have all been observed. Existing unit tests and SQL tests do not substitute for this. No production deployment or migration.
