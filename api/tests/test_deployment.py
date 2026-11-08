import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.deployment import validate_hosted_environment, mount_frontend

def production():
    return {'APP_ENV':'production','WEB_ORIGIN':'https://example.onrender.com','COOKIE_SECURE':'true',
            'DATABASE_URL':'postgresql+psycopg://teamflow_app:test@db.example/db?sslmode=require'}

@pytest.mark.parametrize('key,value',[
    ('WEB_ORIGIN','http://example.com'),('WEB_ORIGIN','https://example.com/path'),
    ('COOKIE_SECURE','false'),('DATABASE_URL','postgresql://owner:test@db.example/db?sslmode=require'),
    ('DATABASE_URL','postgresql://teamflow_app:test@db.example/db'),
    ('MIGRATION_DATABASE_URL','must-not-be-in-runtime'),('DEMO_PASSWORD','must-not-be-in-runtime'),
])
def test_hosted_config_rejects_unsafe_settings(key,value):
    env=production();env[key]=value
    with pytest.raises(RuntimeError): validate_hosted_environment(env)

def test_local_and_hosted_settings():
    validate_hosted_environment({})
    validate_hosted_environment(production())

def test_export_mount_preserves_api_and_rejects_traversal(tmp_path):
    (tmp_path/'index.html').write_text('<h1>TeamFlow</h1>')
    app=FastAPI()
    @app.get('/api/example')
    def api(): return {'ok':True}
    mount_frontend(app,str(tmp_path))
    with TestClient(app) as client:
        assert 'TeamFlow' in client.get('/').text
        assert client.get('/api/example').json()=={'ok':True}
        assert client.get('/missing.js').status_code==404
        assert client.get('/%2e%2e/.env').status_code==404

def test_missing_export_fails_fast(tmp_path):
    with pytest.raises(RuntimeError): mount_frontend(FastAPI(),str(tmp_path))
