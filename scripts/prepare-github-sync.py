"""Prepare an operator-reviewed Supabase import using the existing GitHub CLI login.

No GitHub token is copied; only completed workflow metadata is imported. This is
an explicit read-only sync, not a webhook or a continuous integration connection.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
from uuid import UUID, uuid4
from datetime import datetime


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def prepare(workspace, task_key, repo, workflow, runs):
    workspace = str(UUID(workspace))
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise ValueError('Invalid repository')
    if not re.fullmatch(r'[A-Z][A-Z0-9-]{2,29}', task_key):
        raise ValueError('Invalid task key')
    if not workflow or len(workflow) > 200:
        raise ValueError('Invalid workflow name')
    records = []
    for run in runs:
        if run.get('name') != workflow or run.get('status') != 'completed':
            continue
        if run.get('conclusion') not in ('success', 'failure', 'timed_out'):
            continue  # Cancelled/skipped checks do not establish success or failure.
        run_id, attempt = int(run['id']), int(run.get('run_attempt', 1))
        if run_id <= 0 or attempt <= 0:
            raise ValueError('Invalid workflow identity')
        stamp = run['updated_at']
        datetime.fromisoformat(stamp.replace('Z', '+00:00'))
        branch = run['head_branch']
        if not isinstance(branch, str) or not branch or len(branch) > 255:
            raise ValueError('Invalid workflow branch')
        url = f'https://github.com/{repo}/actions/runs/{run_id}'
        records.append(dict(source_key=f'github:{repo}:{run_id}:{attempt}',
            kind='ci_pass' if run['conclusion'] == 'success' else 'ci_failure',
            title=f'{workflow} #{run_id}: {run["conclusion"]}',
            detail=f'Read-only GitHub CLI sync. Workflow mapped explicitly to {task_key}.',
            observed_at=stamp, payload=dict(repository=repo, workflow=workflow,
                run_id=run_id, run_attempt=attempt, branch=branch,
                conclusion=run['conclusion'], source_url=url, url=url,
                ingestion='operator-cli-sync')))
    # JSON is one SQL literal, never executable source text. Backslash semantics are explicit.
    delimiter = '$sync_' + uuid4().hex + '$'
    return f"""begin;
set local standard_conforming_strings=on;
do {delimiter}
declare w uuid := {literal(workspace)}; t uuid; tracked text; r jsonb; latest uuid;
begin
 select tracked_branch into tracked from public.tf_workspaces where id=w for update;
 if not found then raise exception 'Workspace unavailable'; end if;
 select id into t from public.tf_tasks where workspace_id=w and key={literal(task_key)} and not archived;
 if t is null then raise exception 'Mapped task unavailable'; end if;
 for r in select value from jsonb_array_elements({literal(json.dumps(records))}::jsonb) loop
  if exists(select 1 from public.tf_evidence where workspace_id=w and source_key=r->>'source_key' and task_id<>t) then
   raise exception 'Workflow already mapped to another task';
  end if;
  insert into public.tf_evidence(workspace_id,task_id,source_key,kind,title,detail,origin,active,observed_at,payload)
  values(w,t,r->>'source_key',r->>'kind',r->>'title',r->>'detail','github',false,(r->>'observed_at')::timestamptz,
    (r->'payload') || jsonb_build_object('tracked_branch',tracked,'imported_at',now()))
  on conflict(workspace_id,source_key) do nothing;
 end loop;
 -- Recompute newest observed run separately per branch, preserving other sources/workflows/tasks.
 for r in select distinct jsonb_build_object('branch',value->'payload'->>'branch')
   from jsonb_array_elements({literal(json.dumps(records))}::jsonb) loop
  select id into latest from public.tf_evidence where workspace_id=w and task_id=t and origin='github'
    and payload->>'repository'={literal(repo)} and payload->>'workflow'={literal(workflow)} and payload->>'branch'=r->>'branch'
    order by observed_at desc,(payload->>'run_id')::bigint desc,(payload->>'run_attempt')::int desc limit 1;
  update public.tf_evidence set active=(id=latest) where workspace_id=w and task_id=t and origin='github'
    and payload->>'repository'={literal(repo)} and payload->>'workflow'={literal(workflow)} and payload->>'branch'=r->>'branch';
 end loop;
end {delimiter};
commit;
""", len(records)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('workspace', 'task', 'repo', 'workflow'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repo):
        raise SystemExit('Invalid repository')
    result = subprocess.run(['gh', 'api', f'repos/{args.repo}/actions/runs?per_page=30'], capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('GitHub read failed. Check gh authentication and repository access.')
    sql, count = prepare(args.workspace, args.task, args.repo, args.workflow, json.loads(result.stdout)['workflow_runs'])
    Path('.local').mkdir(exist_ok=True)
    Path('.local/github-sync.sql').write_text(sql, encoding='utf-8')
    print(f'Prepared {count} mapped completed workflow records in .local/github-sync.sql. Review and apply to the intended Supabase project. No GitHub writes made.')
