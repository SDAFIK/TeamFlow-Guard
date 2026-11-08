"""Initialize isolated GitHub Actions service databases, never a local database."""
import os
import psycopg

if os.getenv('GITHUB_ACTIONS') != 'true':
    raise SystemExit('This initializer only runs inside GitHub Actions')
with psycopg.connect('postgresql://postgres:ci-ephemeral-only@127.0.0.1:5432/postgres',autocommit=True) as connection:
    connection.execute("CREATE ROLE teamflow_app LOGIN PASSWORD 'ci-runtime-only'")
    connection.execute('CREATE DATABASE teamflow')
    connection.execute('CREATE DATABASE teamflow_test')
