"use client";
import { useEffect, useState } from "react";
import { api, type Audit } from "@/lib/api";

export function AuditHistory({ workspace }: { workspace: string }) {
  const [items, setItems] = useState<Audit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ items: Audit[]; next_cursor: string | null }>(`/projects/${workspace}/audit?limit=25`, { signal: controller.signal })
      .then(page => { setItems(page.items); setCursor(page.next_cursor); setError(""); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [workspace, revision]);
  async function more() {
    setBusy(true); setError("");
    try {
      const page = await api<{ items: Audit[]; next_cursor: string | null }>(`/projects/${workspace}/audit?limit=25&cursor=${encodeURIComponent(cursor!)}`);
      setItems(previous => [...previous, ...page.items.filter(item => !previous.some(existing => existing.id === item.id))]);
      setCursor(page.next_cursor);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel" aria-label="Audit history">
    <div className="panel-head"><div><h2>Activity & decisions</h2><p>Append-only records, newest first. {items.length} events loaded.</p></div>
      <button className="btn secondary" disabled={busy} onClick={() => { setBusy(true); setRevision(value => value + 1); }}>Refresh history</button></div>
    {error && <p role="alert">{error} Retry with Refresh history or Load older events.</p>}
    <div className="audit-list">{items.map(item => <details key={item.id}><summary><div><strong>{item.summary}</strong><small>{item.actor_name} · {new Date(item.created_at).toLocaleString()}</small></div><span className="version-label">v{item.plan_version}</span></summary><div className="audit-detail"><span className="mono">Event {item.id}</span><pre>{JSON.stringify(item.changes, null, 2)}</pre></div></details>)}</div>
    {!busy && !items.length && !error && <p>No activity yet. Workspace changes and decisions will appear here.</p>}
    {busy && <p role="status">Loading history…</p>}
    {cursor && <button className="btn secondary" disabled={busy} onClick={() => void more()}>Load older events</button>}
    {!cursor && items.length > 0 && !busy && <p>Beginning of workspace history.</p>}
  </section>;
}
