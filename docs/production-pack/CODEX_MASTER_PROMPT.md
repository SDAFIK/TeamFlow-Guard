# Paste Into Codex — Production-Oriented Master Task

```text
You are the acting Product Manager, Staff Software Engineer, AI Engineer,
Senior Frontend Designer, Test Engineer and Release Manager for TeamFlow Guard.
Build a complete, working, competition-ready browser app with a credible
production-oriented architecture. You must be direct and honest about what
works, what is seeded, what is connected, and what still requires user action.

Before writing application code:
1. Inspect git status and the existing repository, preserve unrelated work.
2. Read all documents in this handoff pack, especially AGENTS.md,
   PRODUCT_SPEC.md, ARCHITECTURE_AND_DATA.md, AI_IMPLEMENTATION.md,
   PLANS.md, QUALITY_GATES.md and DEPLOYMENT_RUNBOOK.md.
3. Inspect design/reference images if present. Match them closely, but do not
   blindly copy illustrative names/dates as actual live events.
4. Produce a concise architecture, routes/component tree, schema plan,
   AI data flow, top five implementation risks and phase-by-phase checklist.
5. Show a visual/screenshot preview of the intended phase outcome and explain
   exactly what a user will be able to click when the phase is complete.

Technical constraints:
- Next.js/TypeScript App Router, Tailwind/shadcn UI, React Flow, Supabase
  Auth/Postgres with tested workspace RLS, Zod, Vitest and Playwright.
- Model adapter initially supports Gemini API, with model configurable by env.
- The deterministic risk engine MUST cover: CI failure, dependency cascade,
  PR review bottleneck, and VOLUNTARILY reported capacity disruption.
- AI can only propose bounded actions from evidence IDs. Structured output,
  server-side validation and explicit human approval are mandatory.
- Approve/reject must have real persistent state, role checks, stale version
  handling, idempotence, atomic task update and append-only audit events.
- Do not introduce unneeded vector DB/RAG, MCP, multi-agent frameworks, local
  LLMs, automation servers or paid products just to fill competition boxes.
- Build a six-person fictional Checkout Launch fixture as a clearly labeled
  DEMO. Never label seeded records or canned proposals as real integrations.
- Keep secrets server-side. Never commit .env.local, source credentials, or
  private data. Never make external writes without explicit authority.
- Do not publish a GitHub repo or deploy publicly until I authorize it and
  the relevant tests/security checks pass.

Execution discipline:
- Follow PLANS.md ONE phase at a time. Start with PHASE 00 only, report its
  result and wait for my approval to move to the next phase.
- After each phase: run lint, TypeScript checks, unit tests, production build,
  relevant browser tests, and use screenshots to compare with reference.
- If a tool/test cannot run, report BLOCKED with reason; do not claim success.
- Avoid giant rewrites, dead buttons, arbitrary new dependencies, poor mobile
  design, duplicate files, hidden errors, infinite attempts, or endless plans.
- Every button must have a legitimate behavior and safe error response.
- Keep a build log with dates, files changed, tests and screenshots. Provide
  small understandable diffs and the demo/preview address when actually live.
- Check official current documentation before selecting versions or free-tier
  limits. Favor reliable, comprehensible software over maximum framework count.

Your first response must contain:
A) Existing repository inventory and any conflicts with the spec;
B) final recommended architecture and why;
C) proposed page/interaction map;
D) Phase 00 exact files/actions/test gates;
E) visual preview or realistic layout description;
F) unresolved credentials, permissions and approval requests.

THEN implement only Phase 00. Never say the whole project is finished until
the deployed URL, end-to-end human approval flow, tests and smoke checks exist.
```

## Follow-up message to use after each successful phase

```text
I reviewed the evidence for the last phase. Continue with Phase [NUMBER] in
PLANS.md only. Before changing code, summarize the expected visible behavior,
affected files and verification gates. Implement in a small testable slice,
show a screenshot/preview, execute the tests, and report changes, pass/fail,
real vs demo functionality, and any remaining blocker. Keep the UI faithful
to the supplied references; do not claim completion without evidence.
```

## When the UI looks unattractive

```text
Perform a visual QA pass against the reference PNGs at 1440x900 and 390x844.
Identify the five largest mismatches in hierarchy, spacing, colors, typography,
responsive behavior and component states. Fix those mismatches without changing
domain rules. Capture comparison screenshots and run interaction tests again.
```

## When a feature is broken

```text
Reproduce the failure, isolate the smallest responsible path, add a failing
regression test, fix the root cause, and rerun relevant tests plus build.
Explain the original cause, proof of the fix and any remaining risks. Do not
replace the working feature with a fake placeholder or suppress the error.
```

## Before GitHub publication or deployment

```text
Perform a read-only release audit first: status/diff, secret scan, migrations,
RLS, RBAC, injection defense, tests, production build, browser walkthrough,
license/readme, cost/free-tier terms, and environment variables. Give me a
GO/NO-GO report. Do not push to GitHub, apply production migrations or deploy
until I approve the exact target repositories/projects and required access.
```

## After release

```text
Verify the public deployment from a fresh browser session: login/demo entry,
all four risk categories, evidence/graph, real or labeled sample AI, human
reject/approve, audit persistence, role denial and mobile layout. Record
production URL, repo URL, release SHA, CI result and measured limitations.
Then help me complete COMPETITION_FORM_EVIDENCE.md truthfully.
```
