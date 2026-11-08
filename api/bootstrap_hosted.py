"""One-time/operator migration command; never included in the runtime image.

Usage: python bootstrap_hosted.py --env-file ../.local/hosting.env --seed-demo
The dedicated env file supplies both URLs and a NEW hosted demo password.
"""
import argparse
import os
import runpy
from pathlib import Path
from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from psycopg import sql
from alembic import command
from alembic.config import Config

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--env-file',required=True)
    parser.add_argument('--seed-demo',action='store_true')
    args=parser.parse_args()
    values=dotenv_values(Path(args.env_file).resolve())
    for key in ('DATABASE_URL','MIGRATION_DATABASE_URL','WEB_ORIGIN'):
        if not values.get(key): raise SystemExit(f'Missing {key} in the dedicated hosting file')
    runtime=make_url(values['DATABASE_URL']); admin=make_url(values['MIGRATION_DATABASE_URL'])
    if runtime.username!='teamflow_app' or admin.username==runtime.username:
        raise SystemExit('Use a distinct migration owner and the teamflow_app runtime role')
    if (runtime.host,runtime.database)!=(admin.host,admin.database):
        raise SystemExit('Use direct URLs for the same hosted database and endpoint')
    if runtime.host in ('localhost','127.0.0.1','::1') or not runtime.host:
        raise SystemExit('This command is for a separate hosted database, never the local fixture')
    if any(u.query.get('sslmode') not in ('require','verify-full') for u in (runtime,admin)):
        raise SystemExit('Both hosted database connections must require TLS')
    if not runtime.password or len(runtime.password)<24:
        raise SystemExit('Use a new random runtime password of at least 24 characters')
    if args.seed_demo and len(values.get('DEMO_PASSWORD') or '')<24:
        raise SystemExit('Use a new hosted demo password of at least 24 characters')
    os.environ.update({k:v for k,v in values.items() if v is not None})
    os.environ['APP_ENV']='production'
    for key in ('DATABASE_URL','MIGRATION_DATABASE_URL'):
        os.environ[key]=make_url(values[key]).set(drivername='postgresql+psycopg').render_as_string(hide_password=False)
    owner=create_engine(os.environ['MIGRATION_DATABASE_URL'])
    with owner.begin() as connection:
        existing=connection.scalar(text('SELECT 1 FROM pg_roles WHERE rolname=:role'),{'role':'teamflow_app'})
        if not existing:
            cursor=connection.connection.driver_connection.cursor()
            cursor.execute(sql.SQL('CREATE ROLE teamflow_app LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT').format(sql.Literal(runtime.password)))
            cursor.close()
        elevated=connection.scalar(text("SELECT rolsuper OR rolcreatedb OR rolcreaterole OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) FROM pg_roles WHERE rolname='teamflow_app'"))
        if elevated: raise SystemExit('Existing teamflow_app role is elevated; use an isolated project and a SQL-created role')
    command.upgrade(Config('alembic.ini'),'head')
    runpy.run_path('grant_local.py')
    if args.seed_demo:
        from sqlalchemy.orm import Session
        from app.seed import seed
        with Session(owner) as db: seed(db)
    with create_engine(os.environ['DATABASE_URL']).connect() as connection:
        if connection.scalar(text("SELECT has_table_privilege(current_user,'tasks','UPDATE') OR has_table_privilege(current_user,'audit_events','UPDATE') OR has_table_privilege(current_user,'audit_events','DELETE')")):
            raise SystemExit('Runtime privileges are too broad')
        connection.execute(text('SELECT count(*) FROM projects'))
    print('Hosted migrations and limited runtime access verified. No credentials printed.')

if __name__=='__main__': main()
