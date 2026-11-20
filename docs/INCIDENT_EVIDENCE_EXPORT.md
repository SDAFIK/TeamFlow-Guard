# Incident evidence export

TeamFlow Guard's **Risk Center** offers **Export visible risks (CSV)**. The export is generated on demand from the data already returned to the currently authenticated workspace. It does **not** call a new API or modify database state.

## How to use
1. Enter a saved workspace or the clearly labeled private fictional demo.
2. Open **Risk Center** and select the risk search/filter you need.
3. Select **Export visible risks (CSV)**.
4. Open the local CSV in your spreadsheet application and review the evidence fields.

The button is disabled if no risk rows match the current view. The export reflects only the selected risk list, so use the risk filter deliberately.

## Columns and provenance
Each row includes the workspace, plan version, snapshot time, export time, risk/evidence IDs, source origin, evidence kind, observation time, active/resolved status, severity, source task key, affected task keys, freshness warning, deterministic risk reason and **linked proposal statuses**. Association is based only on matching `risk_id` or an existing evidence ID. A proposal's `pending` status does not imply approval.

**Scope label:** every fictional demo row is marked **FICTIONAL DEMO**. Real project data is not replaced by fictional metrics. This report is an evidence snapshot, **not a verified CI fix, a calibrated risk forecast, or proof that an approval occurred**.

## Privacy and safety
- The export uses the same workspace-scoped responses already supplied to the signed-in user. No new cross-workspace read route is added.
- CSV content may contain project-sensitive task titles, and exports are saved to the **user's local device**. Handle and share them according to your team's permissions.
- Member names, emails, raw webhook payload bodies, tokens and secrets are **not deliberately included** in the export.
- Spreadsheet formula injection is mitigated by escaping CSV quotes, removing control characters and prefixing potentially executable cells.
- No external upload, server-side CSV storage or background telemetry is introduced.

## Verification requirements
- `npm --prefix web test` — includes `web/domain/incident-export.test.ts`, covering demo labeling, scope, linked proposal state, quoting, formula injection and missing data.
- `npm --prefix web run typecheck`, `npm --prefix web run lint`, `npm --prefix web run build`.
- Browser smoke: at 1440px and 390px, open Risk Center, filter to a single risk, download CSV and inspect filename, header, row count, demo label, text encoding, and keyboard accessibility.
- Only merge after CI and review. Do not modify production data for this check.

## Scope boundary
This feature exports tabular **CSV**, but it does **not** import or parse CSV; it is not a scraper, third-party data warehouse, or automated external reporting integration. React Flow remains the actual dependency visualization library. Adding new charting libraries or data stores requires separate tested implementation and disclosure.
