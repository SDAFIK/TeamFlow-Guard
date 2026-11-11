# TeamFlow Guard — product experience and release plan

Prepared 11 November 2026 from the user's newer Drive source. This is an implementation and verification checklist, not a claim that every feature has been released.

## Product promise

Help a real team turn an observed delivery signal into an evidence-backed decision. Every meaningful action should be understandable without training: **plan → connect → observe → understand impact → compare recovery options → approve → track**.

Keep two modes unmistakably separate:

- **Real workspace:** Begins empty. Counts come from persisted tables and are never populated by fixture data.
- **Demo workspace:** Fictional people/events are labeled. Replay events cannot clear real failures or prove that a real integration is connected.

Only an authorized person can approve protected plan changes. AI or deterministic suggestions never write approved changes directly.

## Intended roles and first-run experience

| Role | First task | Allowed actions | UX requirement |
| --- | --- | --- | --- |
| Owner | Create a workspace and first task | Settings, invitations, planning and approvals | A guided, jargon-light setup with visible progress |
| Manager | Coordinate a connected plan | Planning and approvals within role limits | A clear next action and pending approvals |
| Member | Keep assigned work accurate | Their permitted task updates, risk review | Obvious task ownership and useful feedback |
| Viewer | Understand status and decisions | Read-only access | No confusing, clickable write controls |

### Journey and acceptance checks

1. **Start:** A person with no project sees two clearly labeled choices: create an empty workspace or join with an invitation. They are not shown fictional project numbers.
2. **Plan:** A workspace owner can create a task with a suggested editable key, title, owner, estimate and optional due date. A saved confirmation appears. Reloading returns the saved task.
3. **Collaborate:** An owner can invite a teammate to a specific workspace. The invitation is bound to the intended email, expires and can be revoked. A viewer cannot modify tasks or approve changes.
4. **Connect:** A user with at least two tasks can propose a dependency. The backend rejects cycles and incompatible changes; the UI explains what was rejected.
5. **Observe:** A risk appears only when recorded evidence satisfies a stated rule. Risk status includes evidence origin, observed time and freshness.
6. **Understand:** The dependency graph and an accessible list report which unfinished successors are affected. A disconnected task is not counted as affected.
7. **Compare:** The recovery view explains the current plan, each allowed proposed change, trade-offs, and source evidence. Gemini errors have an honest fallback, not fabricated AI responses.
8. **Decide:** An owner/manager sees before/after fields and explicitly approves or rejects. Concurrent or stale decisions are denied transactionally.
9. **Track:** The changed plan and append-only audit survive refresh. Approval does not falsely clear a failed GitHub check.
10. **Recover from errors:** Network, permission and provider errors have a retry, explanation or safe exit. No save-success message appears after failure.

## UX architecture

- **One primary action per screen.** The overview points to the next task, risk or approval rather than presenting every feature as equally urgent.
- **Progressive disclosure.** Keep task entry short; show advanced controls only when needed. Explain unfamiliar terms such as dependency and plan version in context.
- **Navigation.** Preserve URLs, Back/Forward and selected workspace; use clear current-state labels on desktop and mobile.
- **Visual hierarchy.** A restrained deep-navy surface, teal primary actions, neutral information cards, and amber/red only for measured warnings. Avoid invented score gauges or trends.
- **Graphs.** Offer pan/zoom and a keyboard-readable list alternative. Use color plus explicit labels for node status.
- **Motion.** Subtle transitions (150–250 ms) clarify interaction; respect `prefers-reduced-motion` and avoid moving critical controls.
- **Feedback.** Every creation, edit, rejected action and approval tells the user what changed and what to do next.
- **Responsive.** Check 1440, 768 and 390 px. No horizontal document overflow, clipped modal action or inaccessible menu control.

## Delivery slices

| Priority | Slice | Current status | Verification gate |
| --- | --- | --- | --- |
| P0 | New-account welcome and data-backed setup checklist | Implemented locally 11 Nov | Unit tests, lint, typecheck and production build passed; browser QA pending |
| P0 | Clear task creation and saved feedback | Implemented locally 11 Nov | Key-suggestion unit tests passed; browser + hosted persistence pending |
| P1 | Workspace/team creation and invitation UX | Improved locally in Stage 2; role confirmation and link guidance added | New-email confirmation, expiry/revocation, 390px flow |
| P1 | Dependency editor and risk-to-impact explanation | Early validation and readable empty/list states implemented locally | Cycle rejection, list/graph parity, source freshness |
| P1 | Recovery/approval loop | Readability improved; hosted acceptance still needed | Version conflict, unauthorized approval, auditable persistence |
| P1 | Provider-state messaging and Gemini fallback | Error paths implemented; live success unverified | Real bounded provider call or explicit unavailable state |
| P2 | Accessible navigation, keyboard/a11y and refined visual system | Stage 2 CSS hierarchy and form alignment implemented locally | Desktop/mobile visual QA, WCAG-focused manual checks |
| P2 | Automated CI evidence refresh | Manual GitHub sync only | Signed events, deduplication, branch isolation, hosted failure recovery |
| P2 | Production operations | Incomplete | Backups, restore exercise, monitoring, cost controls, incident workflow |

## Release safeguards

- Use only free services unless the user independently approves a paid change.
- Never commit service-role keys, server model credentials, local databases or demo passwords.
- Use Supabase RLS and server-side membership checks. Do not trust client-provided roles.
- Add migrations through the established flow; never run destructive operations on the hosted database to make a test pass.
- Always run unit tests, lint, typecheck and a production build. SQL tests must use a disposable database, and hosted mutating tests need an isolated test workspace.
- If browser execution is blocked in the current environment, state that clearly; static checks do not substitute for desktop/mobile interaction tests.
- Deploy only after connecting the intended release to its matching Git source and verifying environment variables, review gates and the exact resulting URL.

## External dependencies still requiring owner action

1. Confirm real Supabase signup email delivery and allowed redirect origins.
2. Verify the configured Gemini model with a successful, bounded, billable/free-quota-safe real request; the recorded 503 failure is not a success.
3. Decide whether continuous GitHub webhooks are needed beyond the existing manual evidence sync.
4. Run a safe, isolated hosted end-to-end scenario and complete release/accessibility/security checks.

Completion of this plan is demonstrated by observed tests and real user journeys, not screenshots alone.
