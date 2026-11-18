# TeamFlow Guard — Final Competition Submission

**Competition category:** WorkforceOS  
**Project:** TeamFlow Guard  
**Tagline:** Detect delivery risks early. Understand the impact. Keep humans in control.

## Submission links

| Resource | Verified link |
| --- | --- |
| **Live application / instant judge demo** | **https://teamflow-guard.vercel.app** |
| **Complete GitHub source code** | **https://github.com/SDAFIK/TeamFlow-Guard** |
| **Step-by-step 4-minute demonstration** | [DEMO.md](DEMO.md) |
| **Technical overview and setup** | [README.md](README.md) |
| **Latest complete CI regression** | [GitHub Actions](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/44212190001) |
| **Latest authenticated acceptance** | [GitHub Actions](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/44212189999) |
| **Final released branding & UX** | [PR #28](https://github.com/SDAFIK/TeamFlow-Guard/pull/28), [PR #29](https://github.com/SDAFIK/TeamFlow-Guard/pull/29), [PR #30](https://github.com/SDAFIK/TeamFlow-Guard/pull/30) |

### Two-to-four sentence project description (copy into the submission form)

**TeamFlow Guard** is a human-governed AI delivery intelligence platform for small software engineering teams. It turns CI failures, stalled reviews, task dependencies, and capacity constraints into explainable delivery risks, then combines TIC Intelligence, validated deterministic recovery options, and Gemini-assisted recommendations to help teams choose a recovery plan. Proposed actions require authorized human approval, with version checks and an auditable before-and-after record—no silent changes to the project plan. Judges can explore the real application instantly through a private six-member fictional demo without registration.

## Problem and solution

Software teams often know that a build failed or a review stalled, but cannot immediately see **which downstream tasks and release commitments might be affected**. A conventional task board records work; it does not automatically connect evidence, dependency impact, recovery options, and the governance of decisions.

TeamFlow Guard links those stages in one workspace:

1. **Detect the evidence.** Track failing CI, reviews, blocked work and reported capacity constraints. Fictional guest signals are clearly labeled.
2. **Understand the impact.** TIC Intelligence examines the dependency DAG, unfinished downstream effort and evidence-backed risk explanations.
3. **Compare possible recoveries.** Deterministic rules generate feasible actions; Gemini produces a bounded, evidence-linked recommendation using the same allowed action space.
4. **Keep a human in charge.** A lead reviews, approves or rejects proposals. Plan/version checks prevent stale approvals; changes are recorded in the audit timeline.
5. **Recheck the source event.** Approval changes the plan, but a failed CI signal remains until separately verified passing evidence arrives.

## Explore without an account

1. Visit **https://teamflow-guard.vercel.app**
2. Click **Enter Live Demo — No Sign-up**.
3. Open **Overview** to inspect the fictional six-member software team and release risk.
4. Follow the optional in-workspace guide: **TIC Intelligence → Risk Center → Gemini & recovery → Dependencies → Decision Inbox → Audit**. The guide can be skipped or hidden.
5. Explore task planning, capacity and the dependency explorer independently; reset the private demo when needed.

The guest workspace contains ten seeded tasks, nine dependencies, and four initially active fictional risk signals. Guest sessions expire after two hours, with up to three Gemini request reservations per identity. A provider limit may occasionally prevent another AI call; deterministic alternatives and human approval remain available.

## Distinctive technical features

| Feature | Value |
| --- | --- |
| Evidence-first risk detection | Explicit signals rather than opaque task scores |
| Dependency intelligence | Validated DAG, impact focus and critical unfinished effort |
| TIC Intelligence V2 | Explainable current-plan analysis and separately labeled **synthetic** predictive laboratory |
| Gemini + deterministic recovery | Structured candidate actions grounded in evidence and server-side validation |
| Human governance | Pending approvals, permissions, optimistic versions and decision receipts |
| Real shared workspace | Supabase persistence, role-aware members, invitations and audit history |
| GitHub integration | Authenticated signed CI evidence and authorized repository mappings |
| Native public guest demo | Actual product UI, private fictional workspace and no signup requirement |
| Responsive experience | Accessible dark-mode UI, reduced-motion behavior and mobile navigation |

## Technology

**Next.js 16, React 19, TypeScript, Tailwind CSS, Lucide, React Flow, Supabase Auth, PostgreSQL/RLS, Google Gemini, GitHub App webhooks, Vercel, Python/scikit-learn/XGBoost (offline research), Vitest, Playwright and GitHub Actions.**

## Honest scope and testing

- **Operational:** deterministic risk rules, task/dependency operations, human approval and audit persistence, native guest experience. Genuine hosted Gemini generation and approval have been observed.
- **Experimental:** the TIC logistic model laboratory is trained and evaluated on fictional synthetic data. Benchmark results are **not a claim of proven real-world accuracy**. Real-project scoring is disabled.
- **Integration caveat:** automated GitHub PR-review workflows were exercised with controlled signed fixtures; a fresh eligible external reviewer submission in the actual hosted mapping still needs independent verification.
- **Email caveat:** local registration, confirmation, resend and password recovery acceptance passed in disposable Supabase/Mailpit; fresh external mailbox delivery tests are not claimed complete.
- **Privacy and safety:** private per-guest fictional workspace, bounded Gemini use, workspace permissions, explicit decision approval. Guest records are retained until separately reviewed cleanup work is implemented.

## Reviewer information

**No test email, password, manual database setup, or GitHub App installation is needed to explore the competition demo.** If you want to inspect code, the repository contains the versioned schema, frontend/API, risk and AI domain logic, tests and setup instructions. Use the [4-minute judge walkthrough](DEMO.md) for a repeatable demonstration.

---

**Final links to paste into the competition form:**

Website: `https://teamflow-guard.vercel.app`  
Repository: `https://github.com/SDAFIK/TeamFlow-Guard`  
Technical summary: `https://github.com/SDAFIK/TeamFlow-Guard/blob/main/README.md`  
Demo instructions: `https://github.com/SDAFIK/TeamFlow-Guard/blob/main/DEMO.md`
