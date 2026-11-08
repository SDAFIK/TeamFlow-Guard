# TeamFlow Guard working agreement

Read README.md, PHASE_PROGRESS.md and PHASE_00_REVIEW.md before changes. Preserve user work. On 8 November 2026 the user approved continuing the next phases and improving the logo/UI/motion. Local core implementation is authorized; external provider selection and deployment still require explicit choices.

Frontend is Next.js/TypeScript in web; API is FastAPI/Pydantic in api; database is PostgreSQL. Use generated OpenAPI TypeScript contracts. Keep runtime membership checks server-side. No AI may mutate an approved plan. Do not implement fake counts or disguise fixture data as live evidence.

Never print or commit api/.env, .local credentials/database files, cookies or test traces. Runtime SQL credentials have column-limited plan permissions; audit and decision receipts are insert-only. Tests may reverse migrations only against teamflow_test or teamflow_test_utf8, never development or a shared database. OpenAI is selected; GitHub repository creation/upload is authorized. Hosting remains undecided.

After meaningful changes run relevant backend tests, lint/typecheck/build and browser flows at 1440 and 390 px. Record observed results and limitations in PHASE_PROGRESS.md. Read web/AGENTS.md for generated Next.js version-specific instructions.
