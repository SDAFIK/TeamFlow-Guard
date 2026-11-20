<div align="center">

<img src="web/public/teamflow-brand-icon.svg" alt="TeamFlow Guard shield logo" width="105" />

# TeamFlow Guard

### Human-governed AI delivery intelligence for software teams

**Detect delivery risks. Understand their dependencies. Compare recovery options. Keep humans in control.**

[![Live application](https://img.shields.io/badge/Live%20Application-TeamFlow%20Guard-14b8a6?style=for-the-badge&logo=vercel&logoColor=white)](https://teamflow-guard.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![CI](https://img.shields.io/github/actions/workflow/status/SDAFIK/TeamFlow-Guard/validation.yml?branch=main&label=Build%20status&style=flat-square)](https://github.com/SDAFIK/TeamFlow-Guard/actions/workflows/validation.yml)

[**Open TeamFlow Guard →**](https://teamflow-guard.vercel.app) · [Interactive demo](DEMO.md) · [Release acceptance](docs/STAGE9_12_RELEASE_READINESS.md) · [Product tour](#product-tour) · [Architecture](#architecture) · [Local setup](#local-development)

</div>

---

## Product release

Explore the live application using **Enter Live Demo — No Sign-up**, or follow the [interactive product walkthrough](DEMO.md). [Release readiness](docs/STAGE9_12_RELEASE_READINESS.md) documents security, UX, reliability and outstanding independent acceptance checks.

**Scope disclosure:** guest data is fictional; Gemini is optional and quota-limited; synthetic learning benchmarks do not establish real-world accuracy. Remaining external integration and inbox acceptance evidence is tracked in [issue #45](https://github.com/SDAFIK/TeamFlow-Guard/issues/45).

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

## Explore TeamFlow Guard

Try the full product directly at [teamflow-guard.vercel.app](https://teamflow-guard.vercel.app). Select **Enter Live Demo — No Sign-up** to explore the real workspace with a private, fictional six-person team. There is no separate mock interface and no account required to get started.

Inside the workspace, the optional **interactive guide** explains the flow from delivery signals to TIC Intelligence, recovery proposals, dependency impact, human decisions and an understandable audit trail. Follow the steps, jump to any section, or hide the guide to explore independently.

The sample includes ten tasks, nine dependencies and four fictional risk signals. Gemini-assisted recovery is subject to provider availability and guest-use limits; deterministic alternatives are always available. All plan updates require a human decision. Approval alone never resolves a failed CI signal.

For a quick product walkthrough, see [DEMO.md](DEMO.md). The TIC predictive laboratory uses **synthetic data** and is not a validated real-world prediction model.

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

## Quality and testing

The repository includes automated frontend, backend, database and authenticated browser tests. Tests use isolated development resources and do not modify existing production records.

```bash
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
```

See the [CI workflows](.github/workflows) for complete test configuration.

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
