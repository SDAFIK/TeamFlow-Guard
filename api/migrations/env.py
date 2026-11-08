import os
from alembic import context
from sqlalchemy import create_engine
from app.db import Base, database_url
from app import models

engine = create_engine(os.getenv('MIGRATION_DATABASE_URL') or database_url())
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
