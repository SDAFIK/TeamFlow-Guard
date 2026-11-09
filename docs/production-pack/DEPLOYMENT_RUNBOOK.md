# GitHub + Supabase + Gemini + Vercel — A-to-Z Release Runbook

**Important:** This is an execution checklist, **not evidence a deployment exists**. Codex must verify current provider docs and account permissions. Do not run commands that publish or change production without the repository owner's authorization.

## 0. Accounts and constraints

- GitHub account/repository; use a personal repository if deploying with Vercel Hobby. Verify the account you actually control (for Sadib, possibly `SDAFIK`).
- Vercel account. As of 2026-11-08, Hobby is free for qualifying **personal non-commercial** projects and has resource limits; do not use for a revenue-generating startup. Check https://vercel.com/docs/plans/hobby.
- Supabase Free project; current documented free allocation includes two projects and a 500 MB database quota per project. Free projects can pause for low activity. Check https://supabase.com/docs/guides/platform/billing-on-supabase and https://supabase.com/docs/guides/platform/free-project-pausing.
- Google AI Studio account and provider API key. Verify an eligible free-tier model/rate limits at https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/rate-limits. Availability and quota depend on selected model/account/region and can change.

## 1. Create repository and install code locally

```bash
# From an empty, dedicated project folder, only if no existing app:
npx create-next-app@latest teamflow-guard --typescript --tailwind --eslint --app --src-dir
cd teamflow-guard

# Install based on currently supported versions and existing manifests:
npm install @supabase/supabase-js @supabase/ssr zod @xyflow/react lucide-react @google/genai
npx shadcn@latest init
npm install -D vitest @playwright/test
```

Do not blindly rerun `create-next-app` inside an existing codebase. Codex should assess and preserve current files first. Install only libraries actually used and commit lockfile. Set `lint`, `typecheck`, `test`, `build` and `test:e2e` scripts.

## 2. Supabase database and Auth

1. Create a Free Supabase project; choose a strong password and appropriate region.
2. Set app URLs/redirect allowlist for localhost, Vercel preview if needed and final production domain.
3. Apply source-controlled `supabase/migrations` (use Supabase CLI or reviewed SQL workflow).
4. Enable/test RLS before any public clients access data. Public/anon key is only safe with appropriate grants and policies; **service role secret stays server-only**.
5. Configure verified auth, strong role checks and demo seeding; no real teammate PII in public seed.
6. Run database policy tests, including cross-workspace isolation and rejected unauthorized writes.

## 3. Gemini setup

1. Create API key for permitted Gemini API usage, identify an available currently supported model.
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` in **server** environment variables; never use a `NEXT_PUBLIC_` prefix.
3. Test one real structured recovery generation locally with verified evidence.
4. Measure request failures/latency; test quota exhaustion. A demo without API availability should visibly state "AI example mode" rather than silently fake a live call.
5. Set request limits and reasonable retry policy; estimate ongoing costs before public traffic.

## 4. Local preflight

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
```

Run migration+RLS tests, inspect local screenshot at 1440×900 and 390×844, and finish the judge click-through. If Playwright needs a server, use Playwright's documented webServer config. Never mark this step passed without observed exit codes.

## 5. GitHub publish

1. Confirm project ownership, license choice, team consent for public release, and scan for secrets/private data.
2. Ensure `.gitignore` includes `.env*` except safe `.env.example`, build output, DB dump and credentials.
3. `git status`, inspect `git diff`, commit reviewed code. Create a public repo through GitHub UI or authorized `gh repo create`.
4. Push `main` only after confirmation; add branch protection/PR review when available.
5. Add GitHub Actions CI for checkout → Node install → `npm ci` → lint → typecheck → test → build. E2E can run using local fixtures.
6. Add README sections: problem, how it works, screenshots, setup, demo mode, env vars without secrets, limitations, team contribution, license and links.

## 6. Vercel deployment from GitHub

1. In Vercel: **Add New → Project → Import Git Repository**. If Hobby cannot import a GitHub organization-owned repository, use an eligible personal repository or change plan appropriately.
2. Confirm Next.js framework root, build command and environment targeting.
3. Set at minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `APP_BASE_URL` as needed. Set any privileged DB/webhook secrets **only** in server environments and only if code requires them.
4. Deploy; retrieve `https://<project>.vercel.app`. Do not assume it is usable until browser tests pass.
5. Add production URL to Supabase Auth allowed redirects and GitHub App webhook URL if integration is enabled; redeploy when environment/config requires it.
6. Confirm environment variables are not leaked into client bundles, screenshots or logs. Never paste real secret values in a GitHub issue/README.

## 7. Production smoke test (must actually run)

- Fresh private-browser session loads landing/login.
- Demo user can reach isolated sample workspace without administrative credentials being public.
- Dashboard shows risk data and correctly labeled connected/demo status.
- All four risks display source evidence and correct downstream impact.
- AI response is actually generated **or labeled as illustrative sample**.
- Reject leaves tasks unchanged; Approve applies an authorized change once, audit persists.
- Wrong-role user denied; mobile navigation works; errors are actionable.
- Verify live deployed commit SHA is the reviewed one; CI run is green.

## 8. Public competition links and release record

Record only after real deployment:

```text
Production app: https://________.vercel.app
GitHub source:  https://github.com/________/teamflow-guard
Release tag:    v1.0.0-demo
Commit SHA:     ______________________
CI run URL:     ______________________
Demo mode:     connected / seeded / mixed (describe truthfully)
AI provider:    model + version actually tested, or sample mode
Video:          https://youtu.be/________ (Public/Unlisted as required)
Smoke-test date/time: ___________________
```

## 9. Operational caution

Free-tier projects can pause, exceed quotas or throttle. Check account-specific current limits before judge day, confirm service availability shortly before submission, and document a realistic continuity plan. Avoid fake activity loops intended solely to defeat provider limits. For an actual business launch, revisit hosting plans, data protection, backups, monitoring, support and commercial terms.

## Official reference sources

- Vercel plans: https://vercel.com/docs/plans/hobby
- Vercel deployment: https://vercel.com/docs/deployments
- Supabase free billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase security: https://supabase.com/docs/guides/security/production-checklist
- Google Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- GitHub Apps permissions: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
- Codex development workflow: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex
