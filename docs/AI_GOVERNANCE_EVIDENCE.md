# AI governance and evidence guide

This document lists implementation evidence that can be inspected directly in the current TeamFlow Guard source code. It is a product assurance reference, **not a claim of independent security or AI certification**.

## AI recovery — actual runtime

| Evidence | Implementation |
| --- | --- |
| Provider | `web/server/gemini.ts`, `@google/genai`, server-only API key and selected `GEMINI_MODEL` |
| Prompt version | `recovery-gemini-v1` |
| Prompt intent | Bounded software-delivery recovery advice; only supplied evidence IDs and candidate action indices |
| Size/latency boundaries | Input JSON character limit of 24,000; maximum model output tokens of 1,800; SDK timeout of 25 seconds |
| Output | Structured JSON response with the Zod-derived `candidateSchema` in `web/domain/proposal.ts` |
| Output validation | `validateCandidate` rejects unrecognized evidence IDs, duplicate candidate indices and unsupported candidate indices |
| Governance | `requires_human_approval: true` is a required literal in the schema; the model cannot directly approve changes |
| Failure | 401/403/404/429/503 and invalid provider results map to a recoverable failure message; rule-based alternatives remain available |
| Recorded cost evidence | The SDK returns available `usageMetadata` and elapsed latency; do not claim dollar savings without a measured comparison |

The real implementation explicitly treats task titles, CI text and other external source material as **untrusted data, not executable instructions**. A proposed change is not proof that the underlying CI failure was resolved.

## Non-AI foundation

- `web/domain/risk-engine.ts` detects evidence-backed CI failures, blocked dependencies, PR review delays and volunteered capacity constraints.
- `web/domain/graph.ts` traverses directed task dependencies. This is **not GraphRAG** or a graph database.
- The recovery/approval service is responsible for versioned pending proposals, role checks, task constraints and auditable decisions.
- `web/domain/incident-export.ts` derives CSV rows from already-authorized workspace data and clearly labels fictional demo evidence.

## Experimental model

`README.md` explains the TIC V2 synthetic benchmark (12,000 fictional task observations, 120 project groups). This research must **not** be described as real-customer validation or a calibrated predictor of actual release dates.

## External/advanced tools — claim boundaries

The deployed application does **not** require: n8n, LangGraph, a vector database, semantic retrieval/chunking/RAG, custom MCP runtime, prompt caching service, or a local on-device LLM. Team members may separately have used third-party coding assistants/MCP tools during engineering; those are **development tools**, not product runtime dependencies.

## How to demonstrate this transparently

1. Use the fictional **Checkout Launch** guest workspace and explicitly state that the data is synthetic.
2. Inspect a failed CI signal, show its affected tasks, and review the matching evidence ID.
3. Compare deterministic proposals; optionally request Gemini analysis when actually available. Do not substitute a fabricated response if quota is exhausted.
4. Show a real pending proposal and a human decision before showing audit history. Approval never silently changes source CI evidence.
5. Export current risk evidence to CSV, verify the scope label, source IDs and linked proposal status.

## Automated verification and limitations

Use actual GitHub Actions workflow run links for passing frontend, backend, browser and authenticated-local tests. **Never invent counts or test results.** Hosted external mailbox delivery, independent multi-tenant security verification, backup restoration, and customer pilot outcomes remain separate acceptance gates; see `docs/STAGE9_12_RELEASE_READINESS.md`.

This guide is source-linked so a reviewer can distinguish demonstrable features, development tooling, experiments and future work.
