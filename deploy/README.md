# Free hosting: Render + Neon

This is a demo deployment target, not an always-on production service. Keep both accounts on **Free**, use no paid resources, and leave auto-deploy disabled until checks pass.

The Docker image builds the existing Next.js client to static files and serves them from FastAPI on one origin. No Node server is needed in the runtime. The database stays on Neon; application restarts do not erase it. No local database, password file, migration credential or OpenAI key is copied into the image.

## Provisioning order

1. Connect Render and Neon to Codex. Allow Render access only to the private `SDAFIK/TeamFlow-Guard` repository. Create a new Neon **Free** project, preferably near Render's Singapore region.
2. Keep the Neon owner connection string in a dedicated ignored `.local/hosting.env`, not in `api/.env`. Create a fresh random password for the `teamflow_app` SQL role and a different hosted demo password, each at least 24 characters. Do not reuse the local passwords. Both direct connection URLs must include `sslmode=require` (or `verify-full`). Use the `postgresql+psycopg://` scheme for runtime configuration.
3. Populate the dedicated file with `MIGRATION_DATABASE_URL` (Neon owner), `DATABASE_URL` (same endpoint/database, `teamflow_app`), `DEMO_PASSWORD` (new hosted demo login), and `WEB_ORIGIN` (the future HTTPS app origin). From `api`, run `python bootstrap_hosted.py --env-file ../.local/hosting.env --seed-demo`. It applies migrations, creates a SQL-only restricted runtime role, grants column-level writes, and seeds fresh fictional data. It refuses local endpoints or elevated runtime roles. It never changes an existing role's password.
4. Create the Render Docker web service from `render.yaml`, explicitly retaining **Free**. Set `DATABASE_URL` to the restricted runtime URL, and `WEB_ORIGIN` to the service's exact `https://…onrender.com` URL with no trailing slash. `APP_ENV=production` and `COOKIE_SECURE=true` are included in the blueprint. Do **not** add `MIGRATION_DATABASE_URL` or `DEMO_PASSWORD` to Render.
5. Deploy only after GitHub Actions succeeds. Verify `/health/ready`, sign-in, scoped data, rule recovery, approval/rejection, audit persistence and secure cookies at the live HTTPS address. Share the hosted demo password privately, never in the repository. The local app remains independent.

The app has no self-service registration. The fresh demo has the fictional accounts from the project seed and a new private password. Do not upload the development database or publish its local credentials.

## Optional integrations

OpenAI is not required for hosting. Its API usage may cost money separately from free hosting; leave it unconfigured unless separately authorized. Rule-based recovery remains available. For real analysis, set the key/model only as Render secrets and perform one bounded verification.

For GitHub webhooks, add the exact repository/project/workflow mapping and a random `GITHUB_WEBHOOK_SECRET` to Render, then register `/api/webhooks/github` for `workflow_run` deliveries. Do not use the local project ID unless the hosted seed was created. Verify a real signed delivery; do not call a manually signed fixture a GitHub delivery.

## Migrations and recovery

Keep admin credentials in the operator environment only. Take a Neon snapshot before schema changes; run reviewed migrations with the dedicated hosting file, then deploy the compatible application. Revert application code to a known release for rollback; never delete audit history. No automatic destructive schema downgrade is provided. A backup/restore rehearsal still needs to be performed against a separate test branch before any production use.

## Free-tier limits checked 8 November 2026

- [Render Free](https://render.com/docs/free): sleeps after 15 idle minutes, can take about a minute to wake, 750 free instance hours shared per workspace/month, ephemeral local files. Usage quotas can suspend the service. Render Free PostgreSQL expires after 30 days, so it is not used here.
- [Neon Free](https://neon.com/docs/introduction/plans): $0/month, 100 CU-hours per project, 1 GB storage per project and 5 GB public network transfer. Verify limits in the account before provisioning; do not upgrade automatically.
- [Neon role security](https://neon.com/docs/manage/roles): console/API-created roles can receive elevated Neon membership. The runtime role is created through SQL with only the app's required grants.

## Validation

Docker is not installed in the current local workspace. GitHub Actions builds and smoke-tests the image on Ubuntu. The static export is also tested locally through FastAPI. These checks do not prove a live Render/Neon deployment; its URL and end-to-end results must be recorded after account connections are available.
