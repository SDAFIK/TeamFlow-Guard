"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, GitBranch, Github, RefreshCw, Unplug } from "lucide-react";
import { api } from "@/lib/api";
import { Busy } from "./ui";

type Run = { id: number; name: string; status: string; conclusion: string | null; html_url: string; created_at: string };
type Connection = { connected: boolean; repository: string | null; runs: Run[]; warning: string | null };

export function GithubConnection({ workspaceId, planVersion, canManage, onChanged }: {
  workspaceId: string; planVersion: number; canManage: boolean; onChanged: () => Promise<void>;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const reload = useCallback(async () => {
    const status = await api<Connection>(`/projects/${workspaceId}/github`);
    setConnection(status);
    setDraft(status.repository ?? "");
  }, [workspaceId]);

  useEffect(() => {
    let alive = true;
    void api<Connection>(`/projects/${workspaceId}/github`).then(status => {
      if (!alive) return;
      setConnection(status); setDraft(status.repository ?? "");
    }).catch(cause => {
      if (alive) setError((cause as Error).message);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [workspaceId]);

  async function save(repository: string | null) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/projects/${workspaceId}/github`, {
        method: "POST", body: JSON.stringify({ repository, base_plan_version: planVersion }),
      });
      setConfirmDisconnect(false);
      await Promise.all([reload(), onChanged()]);
      setNotice(repository ? "Public repository linked. Recent GitHub Actions are shown below." : "Repository unlinked from this workspace.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(draft.trim());
  }

  return (
    <section className="panel settings-panel github-settings" aria-labelledby="github-settings-title">
      <div className="settings-section-header">
        <span className="section-kicker"><GitBranch size={14}/> GITHUB INTEGRATION</span>
        <h2 id="github-settings-title"><Github size={22}/> Link your code repository</h2>
        <p>See recent CI workflows next to your project plan. This connects a <strong>public repository read-only</strong>; no GitHub account password or token is needed.</p>
      </div>
      {loading ? <Busy text="Checking GitHub link…"/> : <>
        <div className="github-connection-status">
          {connection?.connected ? <><CheckCircle2 size={18}/><div><strong>{connection.repository}</strong><small>Public GitHub repository linked</small></div></> :
            <><Unplug size={18}/><div><strong>No repository linked</strong><small>Link a public repo to see its latest workflows</small></div></>}
        </div>
        {canManage && <form className="github-connect-form" onSubmit={submit}>
          <label htmlFor="github-repository">Repository URL or owner/name</label>
          <div className="github-connect-row">
            <input id="github-repository" value={draft} onChange={event => setDraft(event.target.value)}
              placeholder="https://github.com/your-team/your-repo" autoComplete="off" required maxLength={160} disabled={busy}/>
            <button type="submit" className="primary" disabled={busy || !draft.trim()}>
              {busy ? <Busy/> : connection?.connected ? "Update link" : "Link repository"}
            </button>
          </div>
        </form>}
        {connection?.connected && <>
          <div className="github-run-heading">
            <h3>Latest GitHub Actions <small>Tracked branch: {connection.repository ? "configured in workspace details" : "—"}</small></h3>
            <button className="secondary" type="button" disabled={busy} onClick={() => void reload().catch(cause => setError((cause as Error).message))}>
              <RefreshCw size={15}/> Refresh
            </button>
          </div>
          {connection.warning && <p className="field-help" role="status">{connection.warning}</p>}
          {connection.runs.length ? <div className="github-run-list">{connection.runs.map(run =>
            <a key={run.id} href={run.html_url} target="_blank" rel="noopener noreferrer" className="github-run-row">
              <span className={`github-run-indicator ${run.conclusion ?? run.status}`}/>
              <span><strong>{run.name}</strong><small>{run.conclusion ?? run.status} · {run.created_at ? new Date(run.created_at).toLocaleString() : "Time unavailable"}</small></span>
              <ArrowUpRight size={17}/>
            </a>)}</div> : <p className="github-run-empty">No recent workflow runs for the tracked branch, or GitHub is temporarily unavailable.</p>}
          <a href={`https://github.com/${connection.repository}`} target="_blank" rel="noopener noreferrer" className="text-link github-repo-link">Open repository <ArrowUpRight size={14}/></a>
          {canManage && (confirmDisconnect ? <div className="github-confirm-disconnect">
            <p>Unlink this repository? Existing tasks and audit records will remain untouched.</p>
            <button className="secondary" type="button" onClick={() => setConfirmDisconnect(false)} disabled={busy}>Cancel</button>
            <button className="danger-button" type="button" onClick={() => void save(null)} disabled={busy}>Confirm unlink</button>
          </div> : <button className="text-link" type="button" onClick={() => setConfirmDisconnect(true)} disabled={busy}>Unlink repository</button>)}
        </>}
        <p className="field-help">GitHub Actions are displayed for visibility only. They do not automatically create risk evidence or change tasks. Private repositories and automatic syncing will require a separate GitHub App authorization.</p>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success-banner" role="status"><CheckCircle2 size={16}/>{notice}</p>}
    </section>
  );
}
