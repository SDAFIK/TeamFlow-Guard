# Supabase and Vercel release

Use the dedicated TeamFlow Guard Supabase project `iqsbbmwwayepeqwuxscg` in SDAFIK's Org (Free). Do not touch the unrelated project or local legacy databases. Vercel project: `prj_gOETY3TWpAT5f014WvUsTifoMBG6` in `sadib-dewans-projects` (Hobby). Never enable paid upgrades.

Vercel root directory is `web`, framework Next.js, Node 24. Production configuration is `TEAMFLOW_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_BASE_URL` equal to the exact HTTPS origin. Gemini additionally requires server-only `GEMINI_API_KEY` and `GEMINI_MODEL`. Never expose a service-role key. Preview deployments must use a separate demo project/configuration rather than production credentials.

Apply the ordered migrations with the Supabase migration tool, run security advisors, then build and deploy the tested Git commit. Verify anonymous access, login, roles, task persistence, proposal/rejection/approval and audit on the hosted origin. Preserve deployment protection while verifying previews.

## Repeatable demo preparation

`node scripts/prepare-supabase-demo.mjs` prepares idempotent seed SQL in `.local/hosted-demo.sql`, using independent hosted credentials. Apply that file only to the dedicated project through an authenticated operator connection. Never commit it or the private credential files.

For a fresh rehearsal, `node scripts/prepare-supabase-demo.mjs --new-workspace` creates a new workspace and task IDs, preserving the previous workspace and its append-only decision history. It backs up the previous fixture metadata privately. Apply the generated SQL, then select the new Checkout Launch workspace in the app. This deliberately does not erase old audits or mutate accepted plans. Run the browser suite against the newly selected fixture metadata. The initial seed and browser flow were verified; the fresh-workspace option requires its own operator rehearsal before competition recording.

## Release limitations

The migrated application currently serves provisioned demo memberships; self-service registration, invitations, configurable thresholds, paginated histories, and migrated GitHub ingestion are not complete. The archived production pack describes the larger target, not a claim that every target is delivered. Live Gemini cannot be certified until a provider key/model is configured and a real request passes. Do not invent a successful AI call, measured business benefit, or recorded competition video.

Supabase's security advisor reports leaked-password protection disabled. No RLS warning was reported. Check availability on the Free plan before enabling the optional password feature; do not upgrade to resolve it.
