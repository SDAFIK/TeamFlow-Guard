import json
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db import database_url
import os
from app.seed import seed

command.upgrade(Config('alembic.ini'), 'head')
with Session(create_engine(os.environ['MIGRATION_DATABASE_URL'])) as db:
    seed(db)
import grant_local
from app.main import app
Path('../contracts/openapi.json').write_text(json.dumps(app.openapi(),indent=2),encoding='utf-8')
print('Migration, seed, least-privilege grants and OpenAPI export complete.')
