# TeamFlow Guard — Interactive product walkthrough

**Live website:** https://teamflow-guard.vercel.app  
**Competition submission:** [SUBMISSION.md](SUBMISSION.md)  
**Source code:** https://github.com/SDAFIK/TeamFlow-Guard  

## Start immediately: no account or password needed

1. Open the live website and select **Enter Live Demo — No Sign-up**.
2. The application opens the actual TeamFlow Guard workspace with a fictional six-person team, ten tasks, nine dependencies and four initial evidence-based risks.
3. Follow the optional six-step guide inside the workspace, or select any menu item directly. No predefined click sequence is required.

**This is a private, temporary native guest workspace, not a separate illustrative mock-up.** It uses the actual task planning, TIC Intelligence, recovery, decision and audit interfaces. The demo data is fictional and clearly labeled.

## Follow the complete product journey

| Time | Screen | Show and explain |
| --- | --- | --- |
| 0:00–0:30 | **Overview** | A failing authentication CI check threatens related work. Show the six-member team and linked task/risk summary. |
| 0:30–1:10 | **TIC Intelligence V2** | Explain downstream effort, evidence-backed warnings and synthetic model laboratory. The model scores are experimental, not real-world accuracy. |
| 1:10–2:00 | **Risk Center** | Select the fictional authentication CI failure (AUTH-142), trace affected work, compare feasible rules-based options and select **Analyze with Gemini** if a guest AI call remains available. |
| 2:00–2:45 | **Decision Inbox** | Compare proposed changes and trade-offs; approve or reject one. Show that the plan changes only after human approval. |
| 2:45–3:25 | **Dependencies / Team Capacity** | Trace task prerequisites, inspect affected tasks and reported availability. Propose a dependency instead of silently editing it. |
| 3:25–4:00 | **Audit Log / replay** | Show the readable before/after record, actor and plan version. Replay a fictional passing CI event to resolve the CI evidence; approval alone cannot clear a failed check. |

## What the system genuinely does

- **Evidence first:** tracked failures, review delays, blocked tasks and capacity constraints generate explainable risks.
- **Dependencies matter:** a single blocked prerequisite can affect multiple unfinished downstream tasks.
- **AI is advisory:** Gemini assists with evidence-backed recovery, constrained to validated actions. Rule-based recovery is also available. Human review and version checks control changes.
- **Accountability:** approved decisions are recorded with human-readable activity and expandable technical evidence.
- **Repeatability:** reset your private fictional workspace and explore a different path.

## Demo safety and operating limits

- Anonymous guest identity is limited to two hours. Each guest has a maximum of three Gemini request reservations; provider limits and availability also apply.
- Fictional CI replay is **not** a genuine GitHub webhook. Real GitHub evidence requires an authorized repository and correctly signed event.
- The synthetic TIC benchmark does **not** establish real-world prediction accuracy.
- Demo records must not be used to represent actual employee performance; the capacity feature uses voluntarily reported availability and task estimates.
- Never upload confidential production records or secrets into the sample workspace.

## If something unexpected happens

- **Gemini unavailable / limit reached:** compare the deterministic recovery options, then use Decision Inbox. The AI integration is optional to demonstrate the human approval mechanics.
- **Previously approved actions:** start a new fictional rehearsal or use the **Reset personal demo** action with exact-name confirmation.
- **Guest session expired:** return to the login page and select **Enter Live Demo — No Sign-up** again.
- **Registration not needed:** guests should not use signup or email confirmation to test the fictional workspace.

## Product scope and development checks

[Live validation workflow](https://github.com/SDAFIK/TeamFlow-Guard/actions/workflows/validation.yml) · [Authenticated acceptance workflow](https://github.com/SDAFIK/TeamFlow-Guard/actions/workflows/workspace-lifecycle-acceptance.yml) · [Submission pack](SUBMISSION.md) · [Stages 9–12 release readiness](docs/STAGE9_12_RELEASE_READINESS.md)

The authenticated browser suites run with disposable local Supabase and controlled external-provider transport. A genuine hosted Gemini recovery proposal and human approval have been verified separately; a genuine hosted GitHub review submission, and some external mailbox delivery checks, remain open follow-ups. Do not confuse controlled fixture tests with genuine external provider operations.
