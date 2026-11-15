"use client";
import { useEffect, useState } from "react";
import { api, type Audit, type Overview } from "@/lib/api";
import { Activity, ArrowRight, CheckCircle2, Code2, ShieldCheck } from "lucide-react";
import styles from "./audit-timeline.module.css";
const fields:Record<string,string>={reviewer_id:"PR reviewer",owner_id:"Task owner",priority:"Priority",dependency:"Required prerequisite",position:"Task sequence",due_at:"Target deadline",status:"Task status",title:"Title",description:"Description",available_hours:"Availability"};
export function auditValue(field:string,value:unknown,data:Overview){if(value===null||value===undefined)return "Not assigned";if(typeof value==="object")return JSON.stringify(value);const v=String(value);if(field==="reviewer_id"||field==="owner_id")return data.members.find(m=>m.id===v)?.name??"Former or unavailable member";if(field==="dependency")return data.tasks.find(t=>t.id===v)?.key??"Archived or unavailable task";if(field==="due_at"){const date=new Date(v);return Number.isNaN(date.getTime())?v:date.toLocaleString();}return v.replaceAll("_"," ");}
export function AuditTimeline({items,data}:{items:Audit[];data:Overview}){return <div className={styles.timeline}>{items.map(item=>{const approved=item.kind.includes("approved");return <article className={styles.event} key={item.id}><div className={styles.eventHead}><span className={styles.eventIcon}>{approved?<CheckCircle2 size={22}/>:<Activity size={20}/>}</span><div><span className={styles.eyebrow}>{approved?"RECOVERY APPROVED":item.kind.replaceAll("."," ").replaceAll("_"," ")}</span><h3>{item.summary}</h3><small>{item.actor_name} · {new Date(item.created_at).toLocaleString()}</small></div><span className={styles.version}>Plan v{item.plan_version}</span></div>{item.changes.length>0&&<div className={styles.changes}>{item.changes.map((change,i)=>{const field=String(change.field??"change"),task=data.tasks.find(t=>t.id===change.task_id);return <div className={styles.change} key={i}><div><span className={styles.eyebrow}>{task?task.key:"WORKSPACE CHANGE"}</span><strong>{fields[field]??field.replaceAll("_"," ")}</strong>{task&&<small>{task.title}</small>}</div><div className={styles.diff}><div><small>Before</small><strong>{auditValue(field,change.before,data)}</strong></div><ArrowRight size={18}/><div><small>After</small><strong>{auditValue(field,change.after,data)}</strong></div></div></div>})}</div>}{approved&&<p className={styles.note}><ShieldCheck size={17}/> The approved plan changed. A failed CI signal is resolved only by passing evidence, not by approval.</p>}<details className={styles.technical}><summary><Code2 size={16}/> View technical details</summary><div><span className="mono">Event {item.id}</span><pre>{JSON.stringify(item.changes,null,2)}</pre></div></details></article>})}</div>}


export function AuditHistory({ workspace,data }: { workspace: string;data:Overview }) {
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
    <div className="panel-head"><div><h2>Activity & decisions</h2><p>See who changed what, and verify the outcome. {items.length} events loaded.</p></div>
      <button className="btn secondary" disabled={busy} onClick={() => { setBusy(true); setRevision(value => value + 1); }}>Refresh history</button></div>
    {error && <p role="alert">{error} Retry with Refresh history or Load older events.</p>}
    <AuditTimeline items={items} data={data}/>
    {!busy && !items.length && !error && <p>No activity yet. Workspace changes and decisions will appear here.</p>}
    {busy && <p role="status">Loading history…</p>}
    {cursor && <button className="btn secondary" disabled={busy} onClick={() => void more()}>Load older events</button>}
    {!cursor && items.length > 0 && !busy && <p>Beginning of workspace history.</p>}
  </section>;
}
