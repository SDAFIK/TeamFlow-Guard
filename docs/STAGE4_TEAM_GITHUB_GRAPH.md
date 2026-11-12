# Stage 4 — team invites, public GitHub link, and dependency visualization

This is a source-only review build. **Do not deploy the updated web code before applying the reviewed database migration to the correct Supabase project.** The prior live deployment remains unchanged.

## Included

1. **Workspace invitations:** owners/managers generate an email-bound, expiring invitation as before. The new **Open email draft** action opens the user's configured mail client with the recipient and private link prefilled. The app **does not send email** or store an email service credential.
2. **Public GitHub repository link:** owners/managers can enter `owner/repo` or a GitHub URL in workspace settings. The server confirms it is publicly accessible, then stores its canonical repository slug in Supabase. Connected workspaces can read their latest five GitHub Actions runs for the tracked branch. Other roles can view the connection but not modify it. Linking/unlinking is version-checked and audited. No GitHub token, webhook, OAuth scope, or plan mutation is involved. **Runs are visible only; no automatic evidence import or risk replay.**
3. **Dependency map:** stable topological layering replaces three-column snake paths. It flags malformed/cyclic data, highlights actual upstream and downstream branches, distinguishes risk nodes, and has a readable legend, minimap, controls, responsive sizing and reduced-motion behavior.

## Deployment order and safety

1. Review `supabase/migrations/20261111184927_github_connections.sql` on a **staging** copy of the correct TeamFlow Guard Supabase project. Check the definer RPC authorization, schema diff, policies and audit behavior. Apply only to the intended project after approval.
2. Use separate test users to test owner, manager, member and viewer permissions; an unauthenticated POST must fail; a stale plan version must conflict; an invalid/nonpublic repository must be rejected.
3. Deploy this source to **Vercel Preview**, using the existing TeamFlow Guard project and staging Supabase data. Test the connected UI, responsive layouts and GitHub rate-limit fallback.
4. After review, migrate production first, then promote the approved code. Confirm the existing HTTPS domain, auth and invites, audit entries, and that production protection remains unchanged.

Never expose service-role keys, personal-access tokens, invitation tokens or account passwords in source control or screenshots. Linking to a public GitHub repository is **not** GitHub OAuth or access to private repos. Automated email requires a separate delivery provider and credential configuration; private GitHub repository access requires an authorized GitHub App/OAuth installation.

## Verification snapshot

- New unit coverage: topological order, deterministic positions, invalid graph fallback, GitHub slug validation, private repo rejection, and workflow URL validation.
- Frontend tests, TypeScript, ESLint and production Next.js build were run in the working source directory; see `PHASE_PROGRESS.md` for the outcome.
- The isolated mock browser test was attempted at 1440px/390px but Chromium could not launch in this sandbox (`socket() failed: Operation not permitted`). **This is a test blocker, not a passed browser check.** Live multi-user invites, Supabase migration execution, and real GitHub network responses are unverified until staging.
