# TeamFlow Guard — Competition-to-Production Codex Handoff

**Status:** Engineering specification and execution pack. It is **not** an implemented or deployed application.

**Last reviewed:** 2026-11-08 (Bangladesh time). Recheck hosting/API service terms and model availability when actually deploying.

## One-sentence mission

Help 3–10-person software teams notice delivery risks early, understand the evidence and downstream task impact, and safely approve an AI-assisted recovery plan.

## How to start

1. Open or create a dedicated GitHub repository, suggested name `teamflow-guard`.
2. Extract **this pack at the repository root** so Codex discovers `AGENTS.md` automatically. Keep existing user code if a repository is already present; merge files deliberately.
3. Download the separately provided TeamFlow Guard UI Design Pack, place its PNG images under `design/reference/`, and keep its visual handoff README.
4. Open the repository in Codex. Paste `CODEX_MASTER_PROMPT.md` as the initial task. Ask Codex to work **Phase 00 only**, then review results.
5. Advance through the phases in `PLANS.md`, requiring proof before each phase is marked complete.
6. Create **your own** Supabase, Gemini API, GitHub and Vercel accounts/projects. Keep credentials out of Git. Codex may use normally configured credentials when authorized, but never commit secrets.
7. Deploy only after the test and security gates in `QUALITY_GATES.md` pass. Follow `DEPLOYMENT_RUNBOOK.md`.
8. Use `COMPETITION_FORM_EVIDENCE.md` to describe *only technologies and methods actually verified in the finished repo*.

## Deliverables

| File | Purpose |
|---|---|
| `AGENTS.md` | Durable instructions, boundaries and completion reporting for Codex |
| `PRODUCT_SPEC.md` | Users, scope, risks, flows, acceptance criteria |
| `ARCHITECTURE_AND_DATA.md` | Components, database, API contracts and security isolation |
| `AI_IMPLEMENTATION.md` | Deterministic risk rules, evidence-grounded AI, evaluation and safe fallback |
| `PLANS.md` | Ordered, independently verifiable implementation phases |
| `QUALITY_GATES.md` | Testing, security, accessibility, observability and release criteria |
| `DEPLOYMENT_RUNBOOK.md` | GitHub, Supabase, Gemini API and Vercel publication steps |
| `COMPETITION_FORM_EVIDENCE.md` | How to truthfully answer each AI Depth Score form field |
| `DEMO_AND_VIDEO.md` | Judge-friendly live demonstration and 180-second video structure |
| `CODEX_MASTER_PROMPT.md` | Copy/paste initial instruction and follow-up prompt patterns |
| `.env.example` | Config placeholders, no real secrets |

## Scope discipline

### Must work before public demo

- Login, workspace and a 6-person seeded demo project.
- Persistent task board and interactive dependency graph.
- All four risk categories, each with evidence IDs, state and affected tasks.
- AI-generated structured recovery proposal from bounded evidence when a valid API key/model is configured.
- A transparent, **labeled sample recommendation mode** when the AI service is unavailable; never present a canned response as live AI.
- Human review: before/after, approve/reject, permission checks, idempotent updates and an audit log.
- Responsive dashboard, errors/empty states, accessible controls, browser tests and working public demo URL.

### Optional stretch after core reliability

- Read-only GitHub App/webhook integration for CI and PR data.
- Fine-grained notifications, additional task-board integrations, analytics, multi-workspace invites.

### Explicit non-goals for this release

- Building a Slack replacement or a complete project-management suite.
- Invasive employee surveillance or inference of capacity from chat activity.
- Fully autonomous ticket changes or external code/repository mutations.
- Loans, employment decisions, automated performance ratings or legal compliance claims.
- Fake RAG, fake MCP servers, fake model fine-tuning, or a swarm of agents solely for competition points.

## Architecture at a glance

`Next.js UI → authenticated server actions/API → PostgreSQL + risk engine → bounded AI provider → approval gate → transactional task updates + audit`

Use one deployable Next.js app and one Supabase project until workload measurements justify a split. Document all design decisions and limitations.

## Real-world quality bar

The demo must survive a judge clicking through a failed CI signal, downstream impact, proposal, rejection, approval and historical audit. Do not claim production readiness for paying customers until actual load, security, backup/restore, service-term and privacy reviews are completed.
