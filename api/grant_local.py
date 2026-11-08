"""Grant the local runtime only the access required by Phase 01."""
import os
from sqlalchemy import create_engine, text
from app.db import database_url

engine=create_engine(os.environ['MIGRATION_DATABASE_URL'])
with engine.begin() as connection:
    connection.execute(text('REVOKE CREATE ON SCHEMA public FROM PUBLIC'))
    connection.execute(text('GRANT USAGE ON SCHEMA public TO teamflow_app'))
    connection.execute(text('GRANT SELECT ON users, organizations, projects, memberships, plan_versions, tasks, task_dependencies TO teamflow_app'))
    connection.execute(text('GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, login_attempts TO teamflow_app'))
    connection.execute(text('GRANT SELECT, INSERT, UPDATE ON evidence, risk_findings, recovery_proposals, analysis_runs TO teamflow_app'))
    connection.execute(text('GRANT SELECT, INSERT ON audit_events, decision_receipts TO teamflow_app'))
    connection.execute(text('GRANT INSERT ON plan_versions, task_dependencies TO teamflow_app'))
    connection.execute(text('GRANT UPDATE (status, version, plan_version, reviewer_id, priority, position) ON tasks TO teamflow_app'))
    connection.execute(text('GRANT UPDATE (available_hours) ON memberships TO teamflow_app'))
print('Local runtime grants applied.')
