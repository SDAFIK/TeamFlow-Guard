# TeamFlow Guard — Premium interface pass (Stage 3)

**11 November 2026.** Source-code delivery, not a hosted production release.

## Screen-by-screen improvements

| Screen | Updated behavior and presentation |
| --- | --- |
| Sign in | Responsive two-part welcome/sign-in layout; fluid form sizing, touch-sized inputs, contrast, focus indication; narrow-phone width fix in the updated stylesheet. |
| Overview | Clear next-human-action emphasis, more legible status cards, task-completion indicator, and a **real-data** status-mix bar/legend based on saved task counts. No invented velocity or success projection. |
| Task board | Readable priority/title/assignee hierarchy, clearer cards and toolbar. On phones, board columns scroll horizontally with snapping and an explicit swipe hint; List remains an alternative. |
| Risk center | Consistent evidence-row spacing, severity states, wrapping mobile content, legible empty/filter states. |
| Dependencies | Improved contrast and selection states for the existing impact graph, explanatory captions, and readable list alternative. |
| Decision inbox | Larger decision/evidence targets, clearer comparison rows and human-approval surface. |
| Team capacity | Consistent member panels, legible capacity meters and privacy note, narrower single-column layout on phones. |
| Audit log | Readable expandable event headers and details with explicit keyboard focus. |
| Workspace settings | Consistent form hierarchy, access/integration rows, safer mobile stacking, clearer confirmation surfaces. |

## Cross-screen design system

- Dark navy with restrained teal actions and contrasting blue/amber/red states; consistent panel radii and light surface elevation.
- Rebalanced headings, labels, paragraph sizes, horizontal rhythm and button sizing.
- Visible keyboard focus and hover states, modest transitions and `prefers-reduced-motion` support.
- Shared breakpoint treatment at 1200, 1000, 700 and 390 pixels; fixed-width form/column constraints reduced.
- Global visual layer is isolated in `web/app/final-polish.css`, imported **last** by `web/app/globals.css`. Existing workflow and authorization code is preserved.

## Verification performed here

| Check | Result |
| --- | --- |
| Vitest | **110/110 passed** (10 test files) |
| ESLint | **Passed** |
| Next.js optimized build | **Passed**, 14 routes, Next.js 16.4.5 using webpack; includes TypeScript check |
| Live browser baseline | Observed login screen on desktop/390-pixel phone and identified a 20-pixel narrow-phone overflow on **the previously running instance**. Added a source-level fix; could not confirm it in that separate browser instance. |
| Authenticated screen screenshots | **Not verified:** only unauthenticated sign-in was accessible. |
| Full end-to-end collaboration/AI/database checks | **Not rerun:** external Supabase/Gemini accounts and credentials are not in this source archive. |

The visual design pass is **implemented in source**. A production sign-off still requires screenshot review with real signed-in owner/member accounts on desktop and mobile, accessibility/zoom testing, hosted Supabase permission/persistence tests, and final AI-provider checks. See [Stage 2 release notes](UX_STAGE2_RELEASE_NOTES.md) for exact mock acceptance instructions and live-release gates.

## Local run

From the project root, configure `web/.env.local` using `web/.env.example`, then:

```bash
npm --prefix web ci
npm --prefix web run dev
```

Open `http://localhost:3000`. Rebuild and preview on your own phone (or mobile browser emulation) with a **test account** to sign off on the authenticated screens. The ZIP excludes development databases, private env files, installed packages and build artifacts.

**No GitHub repository, live workspace data, external account, or deployment was changed by this package.**
