# TeamFlow Guard

Local delivery workspace: Next.js/TypeScript frontend, FastAPI/Pydantic API, PostgreSQL persistence, Argon2 passwords and revocable database sessions. The core workflow runs without external service accounts. OpenAI analysis and GitHub evidence are optional integrations.

## Open the running application

Visit **http://localhost:3000** (use `localhost`, not `127.0.0.1`, because origin checks use this address).

Sign in as `asha@demoworks.test` (lead), `nila@demoworks.test` (contributor), or `sami@demoworks.test` (reviewer). The generated local demo password is in `.local/DEMO_LOGIN.txt`. All five fictional demo members share that local-only password. Credentials and database files are ignored by Git. Do not deploy this development fixture.

Implemented: sign-in/out, scoped memberships, editable task status, searchable board/list, interactive dependency impact map with cycle validation, four evidence-based risk rules, labeled sample replay, typed recovery proposals, lead approval/rejection, optimistic versions, idempotent decisions, voluntary availability and append-only audit history. Protected plan changes require approval; approval never clears failing CI. The navy/teal interface includes a refreshed shield wordmark, responsive navigation, native dialogs, focus restoration and reduced-motion support.

## Requirements and first setup (PowerShell)

Verified with Node 24.16.0, npm 11.13.0 and Python 3.14.2 on Windows. PostgreSQL is a workspace-local binary installed by npm; no Docker or Windows service is needed. Keep ports 3000, 8000 and 55432 available.

From the repository root:

```powershell
npm.cmd ci
npm.cmd --prefix web ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r api/requirements.lock.txt
npm.cmd run db
```

Leave that terminal running. On first start the database script initializes `.local/postgres`, creates separate development and test databases, generates random credentials, and writes `api/.env`. It listens only on loopback. Subsequent starts preserve data and credentials.

In a second terminal, apply migrations, seed without overwriting existing records, grant the limited runtime role, then start the API:

```powershell
cd api
..\.venv\Scripts\python.exe setup_local.py
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a third terminal at repository root:

```powershell
npm.cmd run contracts
npm.cmd run dev
```

Use Ctrl+C in each terminal to stop its service. Never delete the PostgreSQL data directory to resolve a startup issue. If a previous process still holds the port, stop that specific local process before restarting. Do not start two database processes against the same data directory.

## Checks

With PostgreSQL running, from `api`:

```powershell
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic check
```

Tests only accept dedicated databases named `teamflow_test` or `teamflow_test_utf8`; only those are migration-downgraded. Development data is preserved. Coverage includes authentication, scope/role controls, migrations, DAG validation, risk rules, proposal conflicts, concurrent decisions, provider failure/invalid references, reviewer capacity, GitHub signatures, replay isolation and restricted runtime SQL privileges.

From repository root:

```powershell
npm.cmd --prefix web run lint
npm.cmd --prefix web run typecheck
npm.cmd run build
node node_modules/@playwright/test/cli.js install chromium
npm.cmd run test:e2e
```

Browser tests require all three services and check 1440 px desktop and 390 px mobile. `PLAYWRIGHT_EXECUTABLE` may point to an existing Chromium executable if the default download is unavailable. Screenshots are saved under `evidence/`, traces/reports under ignored test directories. Traces can contain local session material; do not publish them without redaction.

The generated contract is `contracts/openapi.json` → `web/lib/api-schema.d.ts`. `setup_local.py` exports the current backend schema; `npm run contracts` regenerates TypeScript types. Keep both in sync after API changes.

## Structure and boundaries

- `api/app`: typed API, membership authorization, session handling, SQLAlchemy entities and seed.
- `api/migrations`: versioned Alembic schema.
- `web`: Next.js UI; `/api/*` forwards to loopback FastAPI through the same origin.
- `scripts/database.mjs`: local PostgreSQL lifecycle and credential generation.
- `tests`: browser flows; `api/tests`: database-backed backend tests.
- `design`: approved Phase 00 static wireframes.
- `PHASE_00_REVIEW.md`, `PHASE_PROGRESS.md`: scope, decisions and implementation evidence.

The application role has column-limited task/membership updates and insert-only audit/decision history. Migration credentials remain separate. Plan writers serialize per project; approval revalidates the current version, before-values, membership, reviewer capacity and DAG within the same transaction as the audit entry. Cookies are HttpOnly and SameSite=Strict; browser mutations verify Origin. Sessions store a SHA-256 token digest. No role supplied by the browser grants permission.

This is local development. Registration, password reset, invitations, production HTTPS/cookies, operational secret storage, expiration cleanup, production throttling and hosting are not configured. Navigation remains in-page state at `/`. OpenAI is selected but a live call requires configuration. No production, pilot or model-quality claim is made.

## OpenAI and GitHub

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `api/.env`, then restart the API. The Responses adapter sends only the selected risk, evidence and validated candidate actions; it uses strict structured output, a 25-second timeout, a bounded context/output and 10 requests per project per hour. It records model, prompt version, latency and usage. Failed or invalid responses cannot apply changes. Rule-based recovery is separately labeled and never presented as AI output.

For GitHub, configure `GITHUB_REPOSITORY`, `GITHUB_PROJECT_ID` and `GITHUB_WORKFLOW_TASKS` (exact workflow name to task key JSON). Run `python sync_github.py` from `api` to read completed runs through the existing GitHub CLI login; no token is copied into the app. Source records include the real run URL and observation time. The `TeamFlow validation` workflow is explicitly mapped to the demo release task, not a fictional failing Login check.

`POST /api/webhooks/github` supports completed workflow-run events, raw-body HMAC-SHA256 validation, stable run/attempt deduplication, delivery identity checks, exact repository/task mapping and out-of-order protection by workflow/branch. Set `GITHUB_WEBHOOK_SECRET` only when configuring a reachable HTTPS endpoint. No public webhook or tunnel is created by local setup. Passing replay events cannot resolve real GitHub failures.

The Windows database was copied non-destructively into UTF-8 development/test databases after the original cluster used WIN1252. The original database is retained. Current local URLs are in the ignored `.env`; do not replace them with example URLs. The database startup script preserves existing `.env` entries, including provider keys.

Production builds use the supported webpack compiler because the local Turbopack CSS worker failed to start. Development remains on Next.js's default compiler.

## Reference documentation consulted

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) and installed version-matched client-component/Turbopack documentation.
- [FastAPI password hashing](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/). This app uses opaque database sessions rather than JWTs.
- [Embedded PostgreSQL package](https://www.npmjs.com/package/embedded-postgres).

Only actual implemented packages and measured test evidence may be used in competition claims. No live model evaluation, retrieval system, productivity gain or deployed production service is claimed. See `PHASE_PROGRESS.md` for observed verification and `DEMO.md` for the local walkthrough.

## Free hosting package

The user selected free hosting. `Dockerfile` builds a static export of the same Next.js UI and serves it from FastAPI as one service. `render.yaml` explicitly selects Render Free; persistent PostgreSQL is planned on Neon Free. See [deployment steps](deploy/README.md). No live hosted service is claimed until its URL and end-to-end checks are recorded.

Production startup requires an HTTPS origin, secure cookies and the restricted TLS database connection. Admin migration and seed credentials are rejected in the hosted runtime. Provisioning uses a separate ignored hosting environment file; local credentials/data are not uploaded. OpenAI remains optional and has separate API usage costs.
