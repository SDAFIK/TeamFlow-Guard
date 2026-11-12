# Stage 7 — Intelligent risk protection (review)

## What is implemented
- Signed GitHub App workflow_run completed events are normalized against explicit workspace/repository and workflow/task mappings. Only success, failure and timed_out are accepted. Unmapped events are ignored; PR events remain visibility-only.
- The server-only ingestion RPC atomically saves source records, deduplicates run/attempt, selects current evidence by observation time/run/attempt, ignores unrelated branches, and never writes task status, priorities, ownership or plan version. The existing risk engine traces downstream tasks. Existing recovery proposal and human approval gates remain.
- The Risk Center has a responsive data-driven command center with active risk, unique affected task and GitHub signal counts. Counts are derived from saved data; no predicted delivery probability.
- This is a review branch. Stage 4/5/6 must pass real authenticated acceptance and their prerequisites before release.

## Configuration and safety
1. Complete Stage 6 GitHub App installation in an isolated test repository and authorized workspace.
2. Apply the reviewed Stage 7 migration 20261112074251_github_webhook_evidence.sql only to a disposable staging database first. The RPC is granted only to service_role, not anonymous or authenticated users. A service-role credential is broad privilege: store only in protected server configuration, never expose to browser, chat, logs or source. Production configuration is not authorized by this review.
3. Set TEAMFLOW_GITHUB_INGEST_KEY securely in the server environment and TEAMFLOW_GITHUB_CI_MAPPINGS to a JSON array of explicit mappings: [{"workspace_id":"d92d765b-9b79-4fe3-a494-ae4000000001","workflow_id":123,"task_id":"6cf69563-82e6-49a4-9cf7-a04000000001"}]. IDs are examples, not live values. Confirm task and workflow identity before activation.
4. Deliver signed failure, duplicate, older failure, passing run and unrelated branch events; inspect the evidence and recovery views and confirm plan changes still require human approval. Test failed database writes and GitHub redelivery. No automatic retry queue is implemented; use GitHub delivery redelivery when necessary.
5. Real webhook reachability, GitHub installation, production credentials, migration and authenticated two-user acceptance remain required. No paid resources or production changes made.

Scope limitations: workflow mapping is administrator-configured, not a self-service UI. Only completed CI workflow evidence is ingested; PR review-delay evidence, durable delivery queue, automatic recovery generation, notification delivery and provider activation are deferred. Existing historical/manual CI evidence is kept separate. Removing or changing a mapping requires review of its existing evidence and pending proposals. No guarantee of error-free operation or live AI provider success is made.
