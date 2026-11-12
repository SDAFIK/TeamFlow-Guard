# Stage 6 — GitHub App monitoring (review)

- Public repository linking remains available. An operator-authorized binding gives exactly one existing workspace read-only access to one selected GitHub App repository. The API first checks the signed-in user's workspace membership. Demo workspaces never use these bindings.
- Settings displays CI runs, open PRs targeting the tracked branch, and matching recent GitHub webhook delivery metadata. The panel refreshes every 60 seconds while visible. A signed, bounded webhook receiver acknowledges authorized workflow_run and pull_request events; GitHub retains its delivery receipts. This is read-only monitoring, not durable event ingestion or automatic task-risk mapping.
- No new database migration. Stage 4 migration and real authenticated acceptance remain prerequisites.

## Setup after review

1. Create a GitHub App in the authorized account's Developer settings. Grant repository Metadata, Actions and Pull requests read access only. Subscribe to Workflow run and Pull request events. Install on explicitly selected test repositories only.
2. Verify the installation ID, immutable repository ID and workspace ID. Confirm the workspace members are authorized to see the selected repository metadata. Set the server-only variables GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM), GITHUB_APP_WEBHOOK_SECRET and TEAMFLOW_GITHUB_APP_BINDINGS in the approved deployment environment. Never put credentials in source, browser variables or chat.
3. Example binding format (fictional IDs): [{"workspace_id":"d92d765b-9b79-4fe3-a494-ae4000000001","installation_id":123,"repository_id":456,"repository":"your-org/your-repo"}]. Duplicate workspaces and repository IDs are rejected. Tokens are minted for only the bound repository and never sent to browsers. Repository identity is checked before activity requests. To disconnect, remove the binding and revoke the App's repository access where appropriate.
4. Set the webhook URL to the approved HTTPS origin plus /api/github/webhook. GitHub must be able to reach this endpoint. Existing Vercel protection may block deliveries; do not weaken deployment protection without a separately approved scoped receiver configuration.
5. Test with separate authenticated accounts and a dedicated repository: cross-workspace denial, identity mismatch, revoked installation, CI and PR list, invalid signature, unrelated delivery, desktop/mobile layouts. No production release before all earlier gates and these checks pass.

No GitHub App registered or installed, credentials configured, paid resources created, or production deployment performed. Self-service OAuth, repository selection, durable webhook storage, automatic evidence ingestion and task mapping are deferred. Delivery history is limited to the recent returned GitHub page.

Official references: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app and https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
