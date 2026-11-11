# TeamFlow Guard — UX and workflow hardening (Stage 2)

**11 November 2026.** This source package is a local implementation deliverable, not a production deployment certification.

## What changed

1. **Understandable overview:** Contextual next action considers outstanding decisions before active risks and onboarding. Task-completion progress uses saved statuses, never a fabricated delivery forecast. Real workspaces no longer advertise demo replay inside normal decision guidance.
2. **Task management:** A clear create-task entry point, more readable forms, attention-sorted work, target dates, empty states, and explicit archive confirmation. A task that becomes blocked requires an explanatory note.
3. **Dependency experience:** Disconnected graphs have explanatory empty states and a readable task-list alternative. Connection creation rejects invalid, duplicate, self-referential, or cyclic edges before calling the server. The server remains authoritative.
4. **Human decisions:** Before/after proposal fields use human-readable labels and dates; approved changes still require the existing transactional role, version, and evidence checks.
5. **Team administration:** Reorganized workspace settings, email-bound invitations with an explicit manual-sharing explanation, copyable invitation links, existing invitation status, and confirmation before changing a colleague's role. Preserved a narrow legacy-local project mode.
6. **Premium visual system:** Navy/teal surface hierarchy, spacing, contrast and focus states, legible responsive forms, readable risk/detail cards, subtle motion, and reduced-motion support. Fixed a missing `.form-grid` CSS rule that broke new-workspace form alignment on desktop and mobile.
7. **Code structure:** Separated team settings from workspace creation, made validation and delivery guidance pure/testable domain functions, and kept the previous FastAPI API route intact.

## Verified in this artifact

| Gate | Outcome |
| --- | --- |
| Frontend unit / domain tests | 110 passing (including role-aware focus, due-date priority and DAG checks) |
| ESLint | Passed |
| TypeScript | Passed |
| Next.js production build | Passed (14 pages, 16.4.5 webpack) |
| Gemini provider unit tests | Passed with mocked responses: misconfiguration, bounded context, invented evidence, quota, timeout and fail-closed errors |
| Live Supabase multi-user + persistence | **Not rerun** — no private project credentials supplied with source-only ZIP |
| Live Gemini request | **Not run** — Gemini key/model absent |
| Automated desktop/mobile browser interactions | **Not completed in this runtime** — OS denied Chromium process socket; repeat externally |
| Production security, performance and accessibility audit | Not completed |

The included `scripts/ux-smoke.cjs` is an **isolated mocked-API** browser acceptance script. It checks a lead and viewer at 1440px/390px: overview, task creation and reload, dependency proposal without automatic application, invitation controls, viewer restrictions, client-side errors, and horizontal overflow. A passing mock test proves frontend interaction wiring only; it does **not** prove real database commits or access control.

### Run the mocked browser check

On a machine that allows Chromium/Playwright:

```bash
npm ci
npm --prefix web ci
npx playwright install chromium
npm --prefix web run build
npm --prefix web run start -- -p 3100
```

In another terminal:

```bash
npm run test:ux-mock
```

Set `PLAYWRIGHT_BASE_URL` if your server is not at `http://127.0.0.1:3100`. Set `PLAYWRIGHT_EXECUTABLE` if using a locally installed Chromium. Mocked screenshots are written to `evidence/ux-mock-*.png`. Do not publish login traces from live tests.

### Real release acceptance still required

With an **isolated test workspace** and pre-approved credentials configured outside the repository:

1. Two real user accounts create/join a workspace, persist tasks, and see changes from separate sessions after refresh.
2. A viewer attempts task edit, invitation creation, and approval through both browser and direct API. All writes must be denied by Supabase RLS/server checks.
3. Two competing managers act on the same proposal and verify exactly one accepted decision and one stale/conflict response.
4. Create a valid dependency, try a cycle, add real timestamped evidence, inspect an affected path, approve a safe proposal, and verify audit and plan-version changes survive reload.
5. Run one bounded real Gemini request (or verify explicit unavailable state), review generated evidence IDs, and check rule-based recovery during provider failure.
6. Check real desktop/tablet/mobile layouts, keyboard-only controls, focus restoration, zoom, color contrast, reduced motion, and no horizontal overflow.
7. Review deployment health, RLS policies, data exports/backups, monitoring, CSP, abuse limits and free-tier resource usage before announcing a production release.

**No hosted database, account, GitHub branch, or deployment was changed by this Stage 2 package.**
