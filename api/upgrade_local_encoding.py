"""Copy a legacy local WIN1252 database into a UTF8 database; never delete the original."""
import os
from pathlib import Path
from sqlalchemy import create_engine, text, select, func
from sqlalchemy.engine import make_url
from alembic import command
from alembic.config import Config
from dotenv import dotenv_values,set_key
from app.db import Base
from app import models

env_path=Path(__file__).parent/'.env'
values=dotenv_values(env_path)
source_url=make_url(values['MIGRATION_DATABASE_URL'])
assert source_url.host=='127.0.0.1' and source_url.database=='teamflow'
admin=create_engine(source_url.set(database='postgres'),isolation_level='AUTOCOMMIT')
with admin.connect() as conn:
    for name in ['teamflow_utf8','teamflow_test_utf8']:
        exists=conn.scalar(text('SELECT 1 FROM pg_database WHERE datname=:name'),{'name':name})
        if not exists:
            conn.execute(text(f"CREATE DATABASE {name} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'"))
target_url=source_url.set(database='teamflow_utf8')
os.environ['MIGRATION_DATABASE_URL']=target_url.render_as_string(hide_password=False)
command.upgrade(Config('alembic.ini'),'head')
source=create_engine(source_url,isolation_level='REPEATABLE READ')
target=create_engine(target_url)
with source.connect() as old, target.begin() as new:
    if new.scalar(select(func.count()).select_from(models.User)):
        raise RuntimeError('UTF8 target already contains users; refusing to overwrite')
    for table in Base.metadata.sorted_tables:
        rows=[dict(row) for row in old.execute(select(table)).mappings()]
        if rows: new.execute(table.insert(),rows)
        assert new.scalar(select(func.count()).select_from(table))==len(rows)
for key,name in [('DATABASE_URL','teamflow_utf8'),('MIGRATION_DATABASE_URL','teamflow_utf8'),('TEST_DATABASE_URL','teamflow_test_utf8')]:
    updated=make_url(values[key]).set(database=name).render_as_string(hide_password=False)
    set_key(env_path,key,updated)
print('Verified UTF8 copy complete. Original teamflow database retained; local environment now points to the UTF8 databases. Other environment values preserved.')
