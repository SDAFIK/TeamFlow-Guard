import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')

def database_url():
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise RuntimeError('DATABASE_URL is required. Run local setup first.')
    return url

engine = create_engine(database_url(), pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = sessionmaker(engine)

class Base(DeclarativeBase):
    pass

def get_db():
    with SessionLocal() as db:
        yield db
