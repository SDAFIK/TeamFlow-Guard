# TeamFlow Guard — live product demonstration

Start at [teamflow-guard.vercel.app](https://teamflow-guard.vercel.app). Use a labeled fictional demo workspace, not a real customer project.

## Suggested 4-minute competition journey

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:30 | Overview and project workspace | A CI failure can affect downstream work; the team needs evidence and coordinated recovery. |
| 0:30–1:15 | TIC Intelligence → Start fresh AI rehearsal | A new fictional task and CI event create a repeatable scenario. Model laboratory scores are synthetic, not real-project predictions. |
| 1:15–2:00 | Risk evidence → Compare recovery options | The rule engine supplies feasible choices; Gemini proposes an evidence-backed action. Compare both pending proposals. |
| 2:00–2:45 | Decision Inbox | A lead inspects before/after changes and approves one proposal. Show the updated plan and audit. Approval does not clear failed CI. |
| 2:45–3:30 | Dependencies | Focus a task, trace prerequisites/successors, switch layout, and demonstrate a validated connection proposal. |
| 3:30–4:00 | Replay passing CI; audit | Recovery evidence resolves the fictional failure. Summarize human governance and repeatability. |

## Live GitHub evidence (separate from demo)

Use the administrator-authorized acceptance workspace and its mapped workflow. A real signed GitHub event is recorded as GitHub evidence; a later verified successful run resolves the matching failure. Do not represent fictional replay as a live event. PR review submission requires the correct GitHub App event subscription and a genuine eligible reviewer.

## Rehearsal checklist

- Sign in and confirm the selected workspace is labeled demo.
- Confirm Gemini is configured; use deterministic rules if the provider is unavailable.
- Start a fresh rehearsal instead of repeatedly exhausting the same task's recovery options.
- Keep the plan version and audit trail visible.
- Never approve a stale proposal or claim that approval itself fixed CI.
- Do not share secrets or real project records during the presentation.

For the original local FastAPI demonstration, see [legacy demo](docs/LEGACY_LOCAL_DEMO.md).
