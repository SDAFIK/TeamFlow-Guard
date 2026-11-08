"""Hosted configuration guardrails and optional same-origin static frontend."""
from pathlib import Path
from urllib.parse import urlsplit
from sqlalchemy.engine import make_url
from fastapi.staticfiles import StaticFiles

def validate_hosted_environment(env):
    if env.get('APP_ENV') != 'production': return
    origin = urlsplit(env.get('WEB_ORIGIN', ''))
    if origin.scheme != 'https' or not origin.hostname or origin.path or origin.query or origin.fragment or origin.username:
        raise RuntimeError('Production WEB_ORIGIN must be an HTTPS origin without a path')
    if env.get('COOKIE_SECURE') != 'true':
        raise RuntimeError('Production requires COOKIE_SECURE=true')
    try: url = make_url(env.get('DATABASE_URL', ''))
    except Exception: raise RuntimeError('Production DATABASE_URL is required') from None
    if url.username != 'teamflow_app' or url.query.get('sslmode') not in ('require','verify-full'):
        raise RuntimeError('Production requires the limited teamflow_app role and database TLS')
    if env.get('MIGRATION_DATABASE_URL') or env.get('DEMO_PASSWORD'):
        raise RuntimeError('Migration and seed secrets must not be present in the hosted runtime')

def mount_frontend(app, directory):
    if not directory: return
    root = Path(directory).resolve()
    if not (root / 'index.html').is_file():
        raise RuntimeError('WEB_DIST must contain the exported frontend index.html')
    # Register last: API and health endpoints always take precedence.
    app.mount('/', StaticFiles(directory=root, html=True), name='frontend')
