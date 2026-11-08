"""Explicit read-only local sync using the user's existing GitHub CLI login.

No token is copied into the application. Run from api: python sync_github.py
"""
import json
import subprocess
from app.db import SessionLocal
from app.github import configuration, ingest

def main():
    config = configuration()
    if not config: raise SystemExit('Configure GITHUB_REPOSITORY, GITHUB_PROJECT_ID and GITHUB_WORKFLOW_TASKS in api/.env')
    _, repo, mapping = config
    # Validate the endpoint components before passing them as a CLI argument.
    import re
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo): raise SystemExit('Invalid repository name')
    result = subprocess.run(['gh','api',f'repos/{repo}/actions/runs?per_page=30'],capture_output=True,text=True,check=True)
    runs = json.loads(result.stdout)['workflow_runs']
    count = 0
    for run in sorted(runs, key=lambda r:r['updated_at']):
        if run['name'] not in mapping or run['status'] != 'completed': continue
        with SessionLocal() as db:
            result = ingest(db, {'action':'completed','repository':{'full_name':repo},'workflow_run':run}, source='cli-read-only-sync')
            print(result['message']); count += 1
    print(f'Checked {count} mapped completed runs. No GitHub changes made.')

if __name__ == '__main__': main()
