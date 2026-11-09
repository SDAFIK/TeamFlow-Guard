# Product Specification — TeamFlow Guard

## Problem

Small software teams already use GitHub and task tools, but delivery risks are distributed across CI runs, PR review status, task relationships and voluntary availability updates. People can manually inspect each service, but the cross-system downstream consequences and prioritized next actions are easy to miss. Generic team chat does not compute dependency impact or provide a traceable approval workflow.

## Target users and roles

- Team lead / project manager: views release risk and approves authorized proposed changes.
- Developer: maintains tasks, investigates source evidence, suggests or rejects changes where their role permits.
- Reviewer: sees PR bottleneck and available task context.
- Demo evaluator: gets a safe, read-only or isolated demo workspace; should not access real teammate information.

Roles for MVP: `owner`, `manager`, `member`, `viewer`. Owners/managers can approve task changes for their workspace; members can view relevant evidence and propose feedback; viewers have read-only access. Document and test exact permissions.

## Four detector contracts

### R1 — CI failure

Input: CI run status, repository, tracked branch/commit, relevant mapped tasks. A failed run creates/updates a deduplicated evidence event and risk; a passing retry can resolve the signal. Show why/how task linkage was established. A failing unrelated branch must not automatically mark the release blocked.

### R2 — Dependency cascade

Input: directed `task A blocks task B` edges, task state, release association. From a blocked task, traverse downstream edges and show exact affected nodes. Detect and reject cyclic dependencies or quarantine them with an explicit error. Don't count duplicate nodes twice; graph impacts are facts while delivery time estimates are uncertain.

### R3 — PR review bottleneck

Input: open non-draft PR, requested reviewer, last review/request timestamps, related task, threshold configured per workspace (default illustration 24 hours). Exclude merged/closed PRs. Show source reference and age; don't infer an individual's performance.

### R4 — Voluntary capacity disruption

Input: opt-in availability percentage/date range, impact on assigned critical-path work. Avoid scraping private chats or calendar contents without consent. Only display the minimum necessary capacity data to authorized teammates. Capacity ≠ productivity or employee rating.

## User journeys

1. **Onboard** → sign in → join/create workspace → view sample workspace or connect allowed source.
2. **Monitor** → overview KPIs → risk feed → filter risk type → view evidence.
3. **Understand** → open risk → dependency graph highlights upstream trigger and affected downstream tasks.
4. **Recover** → request AI plan → inspect referenced evidence and estimated effects → view before/after.
5. **Decide** → manager approves/rejects → only approved in-app changes are applied → audit record shown.
6. **Review history** → timeline shows risk lifecycle, proposal, reviewer, decision and resulting task changes.

## Pages

| Route | Required content |
|---|---|
| `/` | Honest landing screen, product explanation, demo entry and auth |
| `/overview` | Four metrics, critical-path map, risk feed, AI insight and queue |
| `/risks` / `/risks/[id]` | Filterable risks, evidence, impact, status and decision links |
| `/tasks` | Task board/list, owner, status, priority, due date and dependencies |
| `/dependencies` | Interactive directed dependency graph, legend, selected-node detail |
| `/decisions` / `/decisions/[id]` | Pending/history and approve/reject review surface |
| `/capacity` | Voluntary availability form and privacy explanation |
| `/audit` | Filterable recorded actions and source links |
| `/settings` | Workspace settings, thresholds, integrations, team membership |

## Competition demo scenario — Checkout Launch

A six-person team has: failing CI run `ci_921` on the release branch; task `AUTH-142` blocked; `LOGIN-210` and `CHK-318` dependent; PR `pr_87` waiting review over the configured threshold; one teammate explicitly reports 50% availability for two days. The dashboard displays the four categories without claiming certainty about a release date. A proposed recovery can reprioritize `AUTH-142`, move an *in-app review assignment* to an available person, and revise an in-app task sequence. Approving changes only local app records, displays before/after values and appends audit entries.

## Acceptance criteria

- Every category has at least one deterministic green/red test and a visible demo example.
- Clicking an evidence row opens the corresponding event or, when disconnected, a labeled demo evidence detail.
- Graph selected-node details list exact upstream and downstream task IDs with no duplicate affected counts.
- Generating a proposal provides a schema-valid result or an explicit unavailable state, not invented live data.
- Reject changes nothing except decision status/audit. Approve updates only allowed records once, even if repeated.
- Unauthorized users cannot approve, access another workspace's data, or read another member's private capacity notes.
- Demo can run from a fresh seed and be reset by an authorized operator without affecting other workspaces.
- Mobile users can reach all actions; graph is navigable by accessible list alternative.

## Quality targets (goals to verify, not measured claims)

- Core demo actions work reliably on a public URL.
- UI is responsive and keyboard-accessible; error/empty/loading states have meaningful copy.
- Normal dashboard queries are indexed and paginated; avoid unnecessary AI calls for every page load.
- Detailed metrics and success claims must be measured during tests, not fabricated in the pitch.
