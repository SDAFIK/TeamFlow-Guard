# Competition AI Depth Form — Truthful Claim and Evidence Matrix

**This document is a completion guide, not a pre-filled claim that tools have been used.** The portal appears to reward an AI Depth Score; points must not drive false tool selections. Check boxes only once the corresponding technology and behavior are verified in the final repository or logs. Update this matrix after each Codex phase.

The screen captures from the competition form include the following sections. The suggested copy below is a **conditional template for the proposed architecture**—edit to past tense only once implemented.

## 1. Prompt Usage (free text)

**When implemented, possible entry:**

> We used role-constrained, versioned recovery prompts. The model receives a bounded evidence package containing verified CI/PR signals, task dependencies, affected task IDs and an explicit action allowlist. We treated task titles and external messages as untrusted data, required JSON schema output, and iteratively tested prompts against negative and adversarial delivery scenarios. All model proposals remain pending until authorized human review.

**Evidence:** `AI_IMPLEMENTATION.md`, active prompt template/version in code, tests and saved run IDs. Do not claim few-shot examples, chain-of-thought exposure or prompt registry software unless actually used.

## 2. Token Optimization (free text)

**When implemented, possible entry:**

> We reduce tokens by retrieving only task/evidence records relevant to the selected risk, trimming unrelated graph branches and large PR/CI logs, using bounded prompts and schema-constrained short JSON output. We trigger model calls on demand rather than on every dashboard render and record measured request token/latency statistics.

**Evidence:** evidence builder, context size tests and provider usage logs. If caching is added, describe cache key, invalidation and actual hit metrics.

## 3. Token Optimization Tools & Methods (checkboxes)

| Screenshot option | Should it be checked? | Proof |
|---|---|---|
| Structured outputs / JSON mode | **Yes, after Phase 05** | Actual provider JSON schema response + validation |
| Sliding-window / context trimming | **Only if implemented** | Context trimming logic + tests |
| Semantic chunk dedup | No, unless actually implemented | Measured dedup function |
| Gemini Context Caching | No unless provider caching API used | Cache configuration and usage |
| OpenAI/Anthropic/DeepSeek Prompt Caching | No by default | Actual matching model/provider API usage |
| Graphify, LLMLingua, Caveman, Codeburn, etc. | No | Would need dependency/invocation and result |
| Cheap-model routing, batching, KV-cache, speculative decoding | No by default | Only if truly implemented/tested |

Do not confuse an application's ordinary in-memory data cache with provider prompt caching.

## 4. LLMs / Models Used (checkboxes + explanation)

- **Gemini:** check only if TeamFlow Guard actually calls Gemini during runtime and the call is demonstrated. Specify exact model from final configuration/logs, not a guessed model name.
- **ChatGPT:** if the rules include development assistance, may describe ChatGPT ideation/code review in that separate capacity; avoid implying ChatGPT is the deployed runtime model if it is not.
- **Claude/Kimi/DeepSeek/Llama/etc.:** unchecked unless genuinely used in this build or deployed workflow; explain actual role if checked.

**Possible explanation after running Gemini:**

> Gemini generates bounded, structured recovery proposals from deterministic risk findings and verified evidence. The server verifies source IDs and allowable actions before creating a pending proposal. Human approval—not the model—authorizes in-app task changes. Codex assisted engineering and testing; it is not represented as the application's runtime agent.

## 5. Retrieval & RAG (checkboxes + architecture)

**Proposed MVP:** leave all RAG technique boxes unchecked. Ordinary SQL lookup of known task IDs and evidence rows for grounding does **not** mean we implemented vector search, embedding/chunking, reranking, GraphRAG or an agentic retrieval system.

**Architecture detail, if asked:**

> We retrieve exact, workspace-scoped records from PostgreSQL by known risk, evidence and task IDs to ground AI recommendations. We do not claim an embedding index or RAG framework in the MVP. Dependency graph traversal is a deterministic application algorithm, not GraphRAG.

If a future version actually embeds documents, retrieves semantically and evaluates evidence faithfulness, update this section with exact chunks, embedding model, index, query and metrics.

## 6. MCP (Model Context Protocol)

Do **not** check “We built and/or used MCP servers/clients in this build” merely because Codex, ChatGPT or an IDE has tools. If an application-specific MCP client/server is developed, provide its actual endpoints, transports, permissions, use cases, repository paths and test runs.

## 7. Open Source Tools & Libraries (free text)

**Possible entry after verifying package use:**

> Next.js/React/TypeScript power the web application; Tailwind CSS and shadcn/ui provide accessible design foundations; React Flow renders interactive task dependencies; Zod validates data and LLM outputs; Supabase client libraries connect authenticated Postgres persistence; Vitest and Playwright verify risk logic and browser behavior. We can show each library in package manifests and functioning source files.

Do not list a library only because it appears in a sample architecture.

## 8. Agent Frameworks & Orchestration (free text)

**MVP answer:**

> The production app uses a custom, bounded evidence-to-proposal workflow rather than an autonomous multi-agent framework. Deterministic detectors establish risk facts, a single LLM call proposes an allowable recovery, and server-side code validates and holds it for human approval. This avoids unnecessary agent handoffs and improves auditability.

Do **not** check LangGraph, CrewAI, AutoGen, OpenAI Agents SDK, Google ADK, etc. unless their actual libraries and workflows are running in TeamFlow Guard.

## 9. Fine-tuning / Adaptation (free text)

Leave blank or write “Not applicable for this release; we use prompting and deterministic rules” if the form permits. Do not claim LoRA, QLoRA, distillation or custom weights without actual training data, scripts and resulting model artifacts.

## 10. Evaluation & Quality Measurement (free text)

**Possible entry after tests execute:**

> We evaluated four deterministic risk detectors using versioned scenarios across CI failure, dependency propagation, PR review delay and voluntary capacity change. Additional tests verify source grounding, JSON-schema validity, rejected unsupported actions, role permissions, duplicate approvals, prompt injection and audit integrity. We ran automated unit/integration tests and Playwright browser flows; the report records exact passing counts and any failures.

Fill actual `N/N` counts, recorded latency and screenshots from observed CI output. Do not invent “95% accuracy” or generic LLM-as-judge metrics.

## 11. Guardrails, Safety & Privacy (free text)

**Possible entry after implementation:**

> We enforce workspace-scoped data access using Supabase Auth/RLS, server-side role checks and Zod input/output validation. AI sees a minimal sanitized evidence bundle; external PR/task content is never treated as instructions. Model responses must reference existing evidence and allowed actions. Sensitive keys remain server-side. An explicit manager approval and atomic task transaction prevent unauthorized or duplicate changes, and the audit log records decisions. Capacity data is voluntarily provided with restricted visibility.

## 12. Frontend AI / Visual App Builders (checkboxes + usage)

If the portal allows "Other", enter **OpenAI Codex** **after** using it for the real frontend implementation. Do not check Cursor, v0, Lovable, Bolt, ChatGPT Canvas, etc. unless those exact tools were used. A design image generated by AI is a visual reference, not proof that an AI frontend builder shipped code.

**Usage explanation template:**

> We used OpenAI Codex as an AI-assisted development agent for component implementation, responsive styling, integration, tests and iterative screenshot review based on a two-screen design reference. The team retained architectural decisions, reviewed changes, fixed issues and verified the working application. The percentage of AI-authored UI is estimated from the reviewed code history and must not be invented.

If the form explicitly requests a percentage, calculate a reasonable documented estimate from committed changes and human review. Do not type a made-up percentage.

## 13. Workflow Automation (checkboxes + explanation)

Leave n8n, Zapier, Make, Airflow, Temporal, Dagster, LangGraph, etc. unchecked unless that tool was installed/configured and performed a real app workflow. A GitHub Actions CI pipeline can be accurately described in narrative, but it is **not n8n**.

## 14. Local / On-device LLMs (runtime/model checkboxes)

Leave all unchecked if all inference uses Gemini cloud API. Ollama, LM Studio, vLLM, llama.cpp, Qwen, Llama and other local-model checkboxes require genuine local inference evidence and hardware details.

## 15. Agentic Frameworks Used (checkboxes)

Leave all unchecked unless genuine usage is present in source/config. Codex writing the application does not mean it uses Hermes, OpenClaw, LangGraph, CrewAI, OpenAI Agents SDK, etc. in production.

## 16. AI Development Lifecycle (AI-DLC)

- **AGENTS.md spec:** mark **only after** Codex actually followed this repo's `AGENTS.md` process in implementation.
- **Other:** the spec-driven Codex workflow documented in this pack can be stated with evidence (phase logs, review records, test gates).
- **AWS Kiro/BMAD/GitHub Spec-Kit/Cursor Rules/Cline Memory Bank/Claude Skills:** leave unchecked unless the actual frameworks/tools were used.

**Possible process note:**

> Development followed a specification-driven Codex workflow: product requirements and acceptance criteria → phase-scoped implementation → automated tests and UI screenshots → human review → CI → deployment smoke tests. We kept durable repository instructions in AGENTS.md, a build plan in PLANS.md, and phase reports with known limitations and evidence.

## Final evidence collection sheet

```text
GitHub repository / release commit:
Production URL:
AI provider / exact model:
First successful live model request date:
Structured-output schema test evidence:
Implemented token methods:
Implemented RAG? (Y/N + evidence):
Implemented MCP? (Y/N + endpoints):
Agent framework actually used in runtime (or none):
Tests run / counts / failing cases:
Security/RLS test evidence:
Frontend AI assistance actually used:
Deployment smoke-test evidence:
Demo video link and public/unlisted availability:
```

## Final warning

A form's automatic 110-point AI Depth Score evaluates how much detail has been entered; it is not independent proof of correctness. A high score earned by misrepresenting tools creates a serious credibility risk when judges ask to see the implementation. Correct, test-backed claims are the competitive advantage.
