<div align="center">

# 🛡️ TeamFlow Guard

### Human-governed AI delivery intelligence for software teams

**Detect delivery risks. Understand their dependencies. Compare recovery options. Keep humans in control.**

[![Live application](https://img.shields.io/badge/Live%20Application-TeamFlow%20Guard-14b8a6?style=for-the-badge&logo=vercel&logoColor=white)](https://teamflow-guard.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![CI](https://img.shields.io/github/actions/workflow/status/SDAFIK/TeamFlow-Guard/validation.yml?branch=main&label=Release%20validation&style=flat-square)](https://github.com/SDAFIK/TeamFlow-Guard/actions/workflows/validation.yml)

[**Launch live application →**](https://teamflow-guard.vercel.app) · [**Competition submission**](SUBMISSION.md) · [Demo walkthrough](DEMO.md) · [Architecture](#architecture) · [Local setup](#local-development) · [Release evidence](#validation-and-release-evidence)

</div>

---

## The problem

Small software teams frequently discover delivery problems too late. A failed CI run, delayed review, blocked dependency or overloaded teammate can affect several downstream tasks. Traditional task boards record work, but the team must still connect the evidence, identify the impact, and decide what to do next.

**TeamFlow Guard** connects these signals to the project plan and offers evidence-backed recovery proposals. A teammate or lead can inspect the reason, compare feasible changes, and approve or reject a proposal. The system does not silently change the approved plan.

## What makes TeamFlow Guard different?

| Capability | TeamFlow Guard |
| --- | --- |
| Evidence-first risk detection | Real GitHub CI signals and explicitly labeled fictional demo events |
| Dependency intelligence | Trace prerequisites, downstream impact and critical estimated dependency effort |
| AI + deterministic rules | Compare Gemini-generated explanations and rule-based recovery proposals |
| Human governance | Validated, versioned proposals; lead approval; persistent audit records |
| Team capacity | Voluntary availability and estimated workload checks, not employee scoring |
| Learning with safeguards | Synthetic model laboratory, owner-consented real-data collection and reviewed candidate training |

## Product tour

| Workspace module | What it does |
| --- | --- |
| **Overview** | Project health, task summaries, risk feed and recovery entry points |
| **TIC Intelligence V2** | Critical dependency effort, evidence-backed warnings, interactive model laboratory and learning controls |
| **Risk Center** | Source evidence, affected tasks, feasible recovery alternatives and AI analysis |
| **Task Board** | Create and update tasks, search/filter work and manage assignments |
| **Dependency Explorer V3** | Dynamic DAG, horizontal/vertical layout, zoom, task focus, draggable cards, animated risk propagation and validated connection proposals |
| **Decision Inbox** | Inspect before/after changes, compare proposals and approve or reject with version checks |
| **Team Capacity** | Report availability and understand estimated workload constraints |
| **Audit Log** | Review recorded decisions and planning changes |
| **Team & Invitations** | Email-bound invitations, role-based access and shared workspaces |
| **GitHub Connection** | Read-only App activity, signed CI ingestion, authorized workflow/PR task mappings and review evidence |

### The intelligent delivery journey

```mermaid
flowchart LR
    A[GitHub CI / task evidence] --> B[Risk detection]
    B --> C[Dependency impact]
    C --> D[Feasible recovery options]
    D --> E[Gemini]
    D --> F[Deterministic rules]
    E --> G[Compare pending proposals]
    F --> G
    G --> H{Human review}
    H -->|Approve| I[Validated plan update]
    H -->|Reject| J[No plan change]
    I --> K[Audit log]
    J --> K
    A --> L[New successful CI run]
    L --> M[CI evidence resolves]
```

A plan approval does not clear a failed CI run. A later verified successful run resolves the corresponding CI evidence.

## Intelligence: three complementary layers

| Layer | Purpose | Release state |
| --- | --- | --- |
| **Deterministic rules** | Detect evidence-backed risks and enumerate allowed recovery actions | Operational |
| **Gemini** | Explain and choose from validated recovery actions with evidence references | Actual provider tested; human approval required |
| **TIC V2 predictive laboratory** | Explore a logistic model trained on fictional project data | Experimental; real-project probabilities disabled |

The TIC V2 synthetic benchmark uses 12,000 fictional task observations across 120 project groups, with project-disjoint train/validation/test splits. The selected logistic model achieved approximately **0.819 average precision, 0.669 precision, 0.916 recall and 0.200 Brier score** on its held-out synthetic test set. These are **synthetic benchmark metrics, not real-world prediction accuracy**.

The learning ledger supports prospective, owner-consented observations and pseudonymous exports. The offline trainer compares logistic regression, random forest and XGBoost using chronological, project-disjoint partitions. Candidate artifacts are review-only: automatic promotion is disabled, and real-world training, serving validation and activation remain future milestones.

## Architecture

```mermaid
flowchart TB
    U[Responsive browser workspace] --> N[Next.js App Router and API]
    N --> A[Supabase Auth]
    N --> P[PostgreSQL / scoped RPCs]
    N --> R[Risk engine and DAG analysis]
    R --> G[Gemini structured recovery]
    R --> D[Deterministic recovery]
    H[GitHub App signed webhooks] --> W[Webhook receiver]
    W --> P
    P --> L[Evidence and audit records]
    P --> T[Consented learning ledger]
    G --> Q[Pending proposal]
    D --> Q
    Q --> P
```

| Technology | Role |
| --- | --- |
| Next.js 16, React 19, TypeScript | Production UI and server routes |
| Tailwind CSS, custom CSS, Lucide | Responsive workspace design |
| React Flow (@xyflow/react) | Interactive dependency graph |
| Supabase Auth + PostgreSQL | Identity, persistence, RLS, scoped database functions |
| Google GenAI SDK + Zod | Structured, validated Gemini recommendations |
| Python / scikit-learn / XGBoost | Offline model research and candidate training |
| GitHub Actions, Vitest, Playwright | Unit, integration and browser regression testing |
| Vercel | Production hosting |

The repository also retains a legacy FastAPI/Python local-development path. The public production application uses the Next.js/Supabase architecture above.

## Competition release — live on Vercel

**Website:** https://teamflow-guard.vercel.app  
**GitHub:** https://github.com/SDAFIK/TeamFlow-Guard  
**Submission overview:** [SUBMISSION.md](SUBMISSION.md)  
**4-minute walkthrough:** [DEMO.md](DEMO.md)

The production release is live, including the premium responsive landing page, updated shield branding, native six-person guest workspace, TIC Intelligence V2, Gemini-assisted recovery, dependency graph, decision inbox and human-readable audit history. The latest Overview banner and loading-screen branding were released through [PR #30](https://github.com/SDAFIK/TeamFlow-Guard/pull/30). Verified GitHub regression and authenticated acceptance: [validation](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/44212190001) and [browser acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/44212189999). Those acceptance tests use disposable local Supabase and controlled external-provider transports; hosted production Gemini was separately verified with a genuine completed analysis and an approved proposal.

### Enter the live guest demo — no signup required

1. Visit the [live website](https://teamflow-guard.vercel.app) and click **Enter Live Demo — No Sign-up**. This creates a private, time-limited guest identity and opens the **actual TeamFlow Guard workspace**, not a duplicate sandbox interface.
2. Inspect **Overview**: six fictional members (one guest owner and five non-login teammates), ten tasks, nine dependencies and four initial fictional risk signals.
3. Open **TIC Intelligence V2** to explore evidence-backed critical dependency effort, warnings and the explicitly **synthetic** model laboratory. Its experimental benchmark scores are not real-world predictive accuracy.
4. Open **Risk Center** → choose the fictional authentication CI failure → **Compare recovery options**. Compare validated deterministic suggestions with a Gemini-assisted proposal.
5. Inspect **Decision Inbox** and approve or reject a proposal. An approval updates the versioned plan only; it **does not automatically repair failed CI**.
6. Explore the **Dependency Explorer**, **Team Capacity** and readable **Audit Log**. Use **View technical details** only when raw evidence or IDs are needed.
7. Replay the fictional passing CI event or reset your private guest demo to start again. Judges can skip or hide the optional guide and explore in any order.

**Guest safety limits:** guest sessions expire after two hours; at most three Gemini reservations per guest identity, with provider availability and global throttles applying. The demo is fictional and private. Normal email-based sign-in remains available for real workspaces.

### Release claims and limitations

- The live Gemini analysis and a human-approved recovery proposal were verified in the hosted guest environment. Automated integration acceptance additionally uses controlled Gemini and GitHub transport fixtures.
- Genuine hosted GitHub PR **review-submission** end-to-end verification is still outstanding; signed event handling has been covered by controlled integration tests. Do not present fictional replay as a real GitHub event.
- Hosted fresh email confirmation/resend and password-recovery delivery have not all been independently verified with an external mailbox; the complete flow passed disposable local Auth/Mailpit acceptance.
- Guest workspace cleanup and fully automated GitHub App onboarding remain future operational improvements. Existing production data was preserved during release.

See [competition submission](SUBMISSION.md) and [demo walkthrough](DEMO.md) for judge-facing guidance.

## Local development

### Prerequisites

- Git and Node.js 24 (npm)
- Docker for a disposable local Supabase stack, or a separate development Supabase project
- Optional Gemini API key for real AI calls; deterministic recovery works without it

```bash
git clone https://github.com/SDAFIK/TeamFlow-Guard.git
cd TeamFlow-Guard
npm ci
npm --prefix web ci
```

**Option A — isolated local Supabase:** use the versioned CLI and the repository migrations.

```bash
npx --yes supabase@2.79.0 start
npx --yes supabase@2.79.0 status
```

Copy `web/.env.example` to `web/.env.local` and fill in the local API URL and publishable/anon key reported by Supabase. Set `APP_BASE_URL=http://127.0.0.1:3000` and `APP_ALLOWED_ORIGINS=http://127.0.0.1:3000`. Configure the matching Auth callback URL in the development Auth settings. Use the local email testing interface for confirmation messages.

**Option B — separate hosted development project:** apply the SQL migrations in order to a new development database, configure Auth and the corresponding URL/publishable key, and use the same environment template. Do not reuse production credentials or reset the production database. Hosted migration history must be reconciled before any migration push.

```bash
npm --prefix web run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Register a development account and create or join a workspace. For the legacy Windows/FastAPI workflow, see [Legacy local setup](docs/LEGACY_LOCAL_README.md).

### Configuration

| Environment variable | Purpose |
| --- | --- |
| `TEAMFLOW_BACKEND=supabase` | Select the production-style backend |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase public connection settings |
| `APP_BASE_URL`, `APP_ALLOWED_ORIGINS` | Exact trusted application origins |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server-only AI provider configuration; validated model: `gemini-3.1-flash-lite` |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET` | Server-only App identity and webhook authentication |
| `TEAMFLOW_GITHUB_APP_BINDINGS` | Administrator-approved workspace/repository installation bindings |
| `TEAMFLOW_GITHUB_CI_MAPPINGS`, `TEAMFLOW_GITHUB_REVIEW_MAPPINGS` | Optional administrator-managed mappings |
| `TEAMFLOW_GITHUB_INGEST_KEY` | Privileged server-only evidence ingestion credential |
| `TEAMFLOW_GMAIL_USER`, `TEAMFLOW_GMAIL_APP_PASSWORD` | Optional direct invitation email delivery |

Never commit `.env.local`, private keys, service-role credentials, tokens, or real learning exports. Only Supabase's public URL and publishable key belong in browser-visible configuration.

### GitHub integration

The production receiver is `POST /api/github/webhook`. It validates raw-body HMAC-SHA256 signatures, immutable repository/installation identifiers, tracked branches, explicit mappings, and event ordering/deduplication. CI ingestion never mutates the approved plan.

An administrator authorizes a repository through the GitHub App. Workspace managers can then add CI workflow and PR-review task mappings in **GitHub connection → Integration setup**. The new database mappings are add-only to preserve historical evidence; existing administrator mappings retain precedence.

For full review lifecycle delivery, subscribe to **Pull request**, **Pull request review** and **Workflow run** events. Review-comment events are not a substitute for review-submission events. Repository authorization remains administrator-managed.

## Security and governance

- Workspace-scoped membership and role checks; owners/managers approve protected proposals.
- Supabase RLS and restricted database RPCs; browser-supplied roles cannot grant access.
- Secure session cookies and trusted-origin checks for mutations.
- Optimistic plan versions, idempotent decisions and cycle validation.
- AI outputs constrained to allowed actions and evidence; invalid or unavailable provider responses fail safely.
- Signed GitHub events and read-only repository access; no automatic plan changes.
- Owner-controlled learning consent and pseudonymous exports; no individual performance ratings.

## Validation and release evidence

| Verification | Evidence |
| --- | --- |
| Intelligence and graph release | [PR #17](https://github.com/SDAFIK/TeamFlow-Guard/pull/17) · [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43390956285) |
| AI comparison and graph scalability | [PR #18](https://github.com/SDAFIK/TeamFlow-Guard/pull/18) · [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43391423711) |
| Workspace-managed GitHub mappings | [PR #19](https://github.com/SDAFIK/TeamFlow-Guard/pull/19) · [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43392725571) |
| Production deployment | [Live application](https://teamflow-guard.vercel.app) |
| Native competition demo, email recovery | [PR #27](https://github.com/SDAFIK/TeamFlow-Guard/pull/27) · [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43657733699) |
| Premium UX and readable audit | [PR #28](https://github.com/SDAFIK/TeamFlow-Guard/pull/28) · [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/43661524133) |
| Final logo across navbar, Overview and loader | [PR #29](https://github.com/SDAFIK/TeamFlow-Guard/pull/29) · [PR #30](https://github.com/SDAFIK/TeamFlow-Guard/pull/30) · [Authenticated acceptance](https://github.com/SDAFIK/TeamFlow-Guard/actions/runs/44212189999) |

The release tests exercise actual local Supabase Auth/PostgREST, multi-user workspace isolation, fictional signed GitHub events, graph drag-and-drop, dependency approvals, cycle rejection, recovery comparison, and desktop/mobile Intelligence UI. The separate real Gemini provider smoke test passed; authenticated Gemini browser tests use an intercepted provider response. Real CI failure/recovery ingestion has also been verified in a dedicated acceptance workspace.

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
```

The [validation workflow](.github/workflows/validation.yml) and [authenticated acceptance workflow](.github/workflows/phase5b-local-acceptance.yml) document the reproducible CI environment. Authenticated tests use disposable local databases, not production records.

## Repository structure

```text
TeamFlow-Guard/
├── web/
│   ├── app/                 # Next.js pages and production API routes
│   ├── components/          # Workspace, graph, intelligence and dialogs
│   ├── domain/              # Risk, graph, recovery and TIC model logic
│   └── server/              # Auth, persistence, Gemini and GitHub integrations
├── supabase/migrations/     # Versioned PostgreSQL schema and RPCs
├── scripts/                 # Acceptance tests, offline training and local tooling
├── api/                     # Legacy FastAPI development backend
├── tests/                   # Browser tests
├── docs/                    # Technical notes and legacy setup
└── .github/workflows/       # CI and release validation
```

## Roadmap and honest limitations

- Complete genuine GitHub PR review-submission/recovery verification with the correct event subscription and an eligible reviewer.
- Add fully self-service GitHub App installation for new customer repositories; current task mapping requires an administrator-authorized repository.
- Collect sufficient consented real project outcomes, independently validate a real candidate model, and implement reviewed serving promotion/rollback.
- Continue full hosted authenticated UX, accessibility, security and performance testing. Current browser acceptance is isolated; public route checks are not equivalent to every authenticated production journey.
- Workspace synchronization uses polling and same-browser notifications, not a guaranteed real-time event stream.

## Contributing

Open an issue describing the problem, expected behavior and reproduction steps. Work on a feature branch, add regression tests, and submit a pull request. Keep real data, secrets and session traces out of commits. Changes to planning logic must preserve approval, tenant isolation and audit guarantees.

---

<div align="center">

**TeamFlow Guard · WorkforceOS project**

Built to help software teams recover from delivery risks without surrendering control of their project plan.

[Live website](https://teamflow-guard.vercel.app) · [GitHub repository](https://github.com/SDAFIK/TeamFlow-Guard) · [Issues](https://github.com/SDAFIK/TeamFlow-Guard/issues)

</div>
