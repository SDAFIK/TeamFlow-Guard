# TeamFlow Intelligence Core — engineering roadmap

Baseline: PR #12 head 5db357a. This branch is a stacked development branch, not production.
No paid resources, production writes, secret disclosure, or promotion before all gates.

## Stage gates
0. Inventory existing Next.js production backend, Python legacy backend, migrations and tests. Reuse the existing risk, proposal, audit and auth contracts.
1. Evidence: signed GitHub workflow events, exact installation/repository/task mapping, idempotent DB ingestion, failure/pass ordering. Add receiver boundary tests. Live acceptance requires dedicated GitHub App installation, disposable database and a test repository. PR/issue ingestion requires explicit mappings, lifecycle semantics and separate tests; do not infer task identity from text.
2. Provider: retain Gemini as default; optional OpenAI only when explicitly configured and paid use authorized. Rules fallback must be labeled, never silently presented as AI. Extend proposal source constraints and audit metadata before exposing OpenAI. Test structured output, refusal, timeouts, quota, invalid evidence and unsupported actions.
3. Intelligence: use deterministic graph/capacity/recovery functions as authority; add versioned task-level risk features and explainable score. No automatic plan writes.
4. ML: reproducible synthetic generator, project-group holdout, baseline and classifier, report precision/recall/F1/calibration and limitations; CPU-only training. Export versioned inference artifact with feature schema. Synthetic scores are not validated probabilities for real projects. Real outcome data requires consent and chronological evaluation.
5. Integration: validate workspace authorization, stale plan/evidence, idempotency, audit and model version; no production migration until reviewed and tested.
6. QA: existing CI plus new boundary/model tests, no secret-dependent CI against production.
7. Live acceptance: isolated owner/member/viewer, actual signed GitHub delivery, real configured AI, approval/rejection, audit and replay. No existing production data mutations.
8. Release: reviewed migrations only if needed, green exact-head CI, verified staging, production approval and smoke checks.
9. UI polish: defer broad redesign until core gates pass.

## Current audit
Existing web/server/github-app.ts, github-evidence.ts and webhook route already implement signed CI events. Stage 7 migration implements ordered/deduplicated evidence. Existing Gemini adapter validates candidate IDs and indices. Existing risk engine and recovery options compute deterministic evidence and feasible actions. OpenAI source is not yet allowed by DB constraints; do not mislabel it as Gemini. Python API is not the authoritative production integration layer.

## Stage 1 test evidence
Receiver tests exercise raw HMAC verification, authorization, normalized mapping, bounded inputs and ingestion failure. They use mocked persistence; SQL ordering/deduplication and live provider delivery remain separate gates.
