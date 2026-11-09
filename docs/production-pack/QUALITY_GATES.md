# Production Software Management — Quality and Safety Gates

## Definition of Done (per feature)

- Requirement and happy path are implemented with real state and server validation.
- Error, empty, loading, permissions and retry cases are visible and tested.
- Relevant logic and browser tests pass; UI screenshot matches design reference where applicable.
- Data persists through reload; audit is accurate for mutations.
- No secrets exposed; no misleading integration/AI claim.
- PR/review is ready, changelog and any decision notes are updated.

## Minimum scripts Codex must provide

| Command | Required result |
|---|---|
| `npm run lint` | No blocking lint errors |
| `npm run typecheck` | Strict TS type checks pass |
| `npm test` | Pure rule/schema/permission tests pass |
| `npm run build` | Production build passes |
| `npx playwright test` | Judge-critical end-to-end paths pass |
| `npx supabase test db` (if configured) | RLS allow/deny SQL tests pass |

## E2E judge flow (automate with Playwright)

1. Open public app / demo login.
2. Enter six-member seeded Checkout Launch workspace.
3. Observe all four independently labeled risk categories.
4. Open failed CI evidence and view impacted dependency nodes.
5. Generate a real AI proposal **if an API is configured**; otherwise see explicitly labeled sample mode.
6. Open the decision screen, inspect before/after, reject once; assert tasks unchanged and rejection logged.
7. Generate/select a second pending proposal; approve as manager; assert task version updated once and audit event exists.
8. Reload; verify persisted changes and timeline.
9. Sign in as viewer; confirm approval forbidden.
10. Narrow viewport; confirm navigation, card layouts and graph fallback work.

## Security review

- Auth cookie/session best practices; CSRF defense for authenticated mutations as applicable.
- Workspace membership and RBAC validated on **server** and RLS, not just hidden UI.
- Strict JSON input validation; size/rate limits on proposal generation and webhooks.
- Sanitized logs; stored XSS mitigation; prompt injection treated as untrusted data.
- No public Supabase service-role key; no backend AI key in `NEXT_PUBLIC_*` vars.
- Webhook raw-body HMAC check, event ID idempotence and constrained repository access.
- SQL atomic decision execution; no duplicate, stale or partial updates.
- Explicit capacity privacy, consent and role-based visibility.
- Dependency updates reject cycles and cross-tenant links.
- Run `npm audit` as informative triage, inspect real production dependencies, document remediations.
- Verify no credentials, private user data or unlicensed media in public Git history.

## Accessibility / UX

- Keyboard navigation, clear focus rings, dialog focus management, readable error copy.
- Labels for icons and graph edges, accessible text alternative for node connections.
- Real empty state, disconnected integration state, loading skeleton and no-API state.
- Mobile at 390×844, tablet around 768px and desktop 1440×900; no horizontal page overflow (graph viewport may scroll intentionally).
- Respect reduced-motion preference; avoid distracting animation.

## Reliability and operations

- `/api/health` returns only non-sensitive app status; separate deeper admin diagnostics from public health.
- Server request IDs and structured error boundaries; never log model keys, auth tokens or confidential raw PR text.
- Database migration rollback procedure and one tested seed reset for **demo-only** workspaces.
- Export/backup plan documented; do not assume free-tier backup guarantees.
- Provider timeout and 429 handling with visible fallback.
- Track actual usage before claiming p95 latency, uptime, cost reductions or recovery success rates.

## Release gates (blocking)

**BLOCK release** if approval bypass, unauthorized workspace leak, exposed secret, broken route, data loss, nonfunctional main action or fake live AI display exists. **DOCUMENT** nonblocking limitations such as optional GitHub connector not configured. Never say “100% error-free”; state tested scope and known limitations.
