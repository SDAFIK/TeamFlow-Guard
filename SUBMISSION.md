# TeamFlow Guard — Competition Submission Pack

**Product:** TeamFlow Guard  
**Category:** WorkforceOS / collaborative software-team delivery intelligence  
**Live interactive product:** https://teamflow-guard.vercel.app  
**Source code:** https://github.com/SDAFIK/TeamFlow-Guard  
**Four-minute judge walkthrough:** [DEMO.md](DEMO.md)  
**Validation:** https://github.com/SDAFIK/TeamFlow-Guard/actions/workflows/validation.yml  
**Stage 8 external integration acceptance:** [open evidence issue #45](https://github.com/SDAFIK/TeamFlow-Guard/issues/45)

> **Submission status:** the repository, live app and written demonstration are ready to share. No external competition portal submission or video upload is asserted by this file; those require the competition portal and a separately recorded video link. This release is a **competition demonstration**, not a certified enterprise service or validated real-world prediction product.

## Short product summary (copy into a 2–4 sentence submission field)

TeamFlow Guard is a risk-aware delivery workspace for small software teams that connects tasks, dependencies, capacity and verified CI/PR signals. It detects risks early, explains downstream impact, and generates evidence-grounded recovery options using deterministic rules and optional Gemini assistance. Authorized team leads approve or reject proposed plan changes, while workspace-scoped permissions and an audit trail make each decision accountable. Judges can explore the actual product immediately using its isolated, fictional guest demo—no signup required.

## The problem

Teams often see a failing check or a delayed PR review in one place, blocked tasks in another, and overloaded contributors somewhere else. Existing task boards record the plan, but do not automatically connect these signals to the dependencies that make delivery risky. Manually coordinating a recovery wastes time and can introduce unreviewed plan changes.

## What we built

- **Overview:** project progress, active risks, status breakdown and clear next actions.
- **TIC Intelligence V2:** evidence-based impact, critical dependency effort and a transparently labeled **experimental synthetic** learning laboratory.
- **Risk Center:** signals from CI failures, review delays, dependency blockages and voluntarily reported capacity.
- **Dependency Explorer:** interactive task graph showing blocked downstream work and validated dependency proposals.
- **Recovery & Decision Inbox:** deterministic options and optional Gemini proposals with verified action allowlists, role-based human approval, plan-version checks and immutable decision history.
- **Team & GitHub:** authenticated shared workspaces, invitations, roles, public read-only repo links and signed GitHub App integrations when correctly authorized.
- **Guest demo:** a native, private, fictional six-person workspace with realistic tasks, dependencies, risks and repeatable scenarios.

## Differentiation

**Evidence → impact → proposed action → explicit human decision → audit** is the core flow. A recommendation is not silently executed, and approving a plan change never fabricates a successful CI event. The risk engine remains usable when an AI provider is unavailable. Integration metadata and demonstration signals are labeled so judges can distinguish live external evidence from simulated data.

## Four-minute demonstration script

| Timestamp | Action | What to say |
| --- | --- | --- |
| 0:00–0:30 | Open live site → **Enter Live Demo — No Sign-up** → Overview | “TeamFlow Guard keeps the plan, evidence and human decisions together. The demo uses fictional data.” |
| 0:30–1:05 | TIC Intelligence → risk summary | “Risk is explained by source evidence and downstream effort. Experimental model scores are synthetic, not claimed as real-world accuracy.” |
| 1:05–1:45 | Risk Center → failing CI → dependent tasks | “A failed signal impacts more than the original task. We can see which unfinished work is affected.” |
| 1:45–2:30 | View deterministic recovery options; optional **Analyze with Gemini** only if available | “AI is optional and bounded. The server validates action references and never applies a suggestion automatically.” |
| 2:30–3:15 | Decision Inbox → compare and approve/reject | “Only authorized humans can change the approved plan. Rejections preserve the current plan and decisions are auditable.” |
| 3:15–3:45 | Dependency Explorer / Capacity | “We see the graph and reported workload before changing dependencies or assignments.” |
| 3:45–4:00 | Audit Log / replay a fictional success | “Every decision has provenance. A later passing CI signal, not just approval, resolves the CI failure.” |

**Plan B if Gemini is throttled:** show deterministic recovery, human decision and audit. Do not call a simulated response “live AI.” If the demo is expired, start another fictional guest workspace.

## Architecture in one paragraph

The application uses **Next.js 16 + React 19 + TypeScript** for its UI and Node.js routes, **Supabase Auth + PostgreSQL** for scoped persistence, **React Flow** for dependency visualization, **Zod** for input/output validation, **Google GenAI** for optional structured Gemini recommendations, and **GitHub Actions/App** for CI and authorized webhook evidence. **Vitest**, backend Python/SQL tests and **Playwright** protect main flows. Vercel hosts the public web app. A legacy FastAPI path exists for local development; it is not represented as the primary hosted runtime.

## What is implemented vs. independently certified

| Claim | Evidence / limitation |
| --- | --- |
| Guest demo, tasks, dependencies, risks, approvals and audit | Public product and automated local/browser acceptance |
| Real Gemini usage | Historical hosted demo-workspace analysis records with usage metadata; provider-console confirmation and quota tests remain open |
| Real GitHub CI activity | Genuine sandbox failure and success runs; GitHub App received a sandbox PR review-request event with HTTP 204 (ignored because no authorized mapping was configured) |
| Real human GitHub review → TeamFlow risk resolution | **Not yet certified**; a sandbox Bot review is not human review approval |
| External auth / invitation inbox delivery | Local Mailpit/PKCE tests and historical accepted invitations exist; recipient-inbox proof remains open |
| Hosted outsider denial & recovery/restore | Local isolation/security tests exist; independently isolated hosted acceptance and backup restore proof remain open |
| TIC synthetic benchmark | Fictional research dataset only; never present results as real-world model accuracy |

The complete acceptance report and remaining external dependencies are maintained in [Stage 8 report](docs/STAGE8_REAL_INTEGRATION_ACCEPTANCE.md) and [issue #45](https://github.com/SDAFIK/TeamFlow-Guard/issues/45). None of these limitations prevents reviewers from exploring the clearly labeled **competition demo**.

## Submission checklist

- [x] Public GitHub source and a clear README
- [x] Public live website and passwordless guest demo
- [x] Four-minute walkthrough script with honest AI/provider fallback
- [x] Product description, technical approach, differentiators and validation links
- [x] Code release with CI and a tracked known-limitations report
- [ ] Record and upload the actual four-minute screen walkthrough; add its verified URL here
- [ ] Enter any required team-member names, eligibility details, category and original-work declarations in the competition portal
- [ ] Confirm the competition's final deadline, attachment limits and video visibility
- [ ] Submit the portal form and capture the confirmation/reference number

**No private credentials, production user data or invitation tokens belong in the public submission.**

## Final judge rehearsal

1. Check live `/`, `/login`, `/api/health` and judge demo route from a clean browser.
2. Run a freshly provisioned fictional guest workspace: simulate a failing signal, inspect downstream tasks, compare recovery, reject once, then approve a second option and inspect audit.
3. Test 390px mobile, 768px tablet and 1440px desktop. Keyboard users should be able to use **Skip to main content** and dialogs.
4. Check the latest `main` CI. Avoid presenting fixture-based tests as live email/GitHub ingestion.
5. Keep a fallback screen recording and screenshots ready if the network or optional AI provider is unavailable during judging.

_This guide is suitable for a competition submission; it does not claim an unperformed external portal submission, production recovery drill or real customer pilot._
