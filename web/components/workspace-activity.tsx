"use client";
import { useState } from "react";
import { Bell, Activity } from "lucide-react";
import type { Audit } from "@/lib/api";
import { Modal } from "./ui";

export function WorkspaceActivity({ entries, onViewAll }: { entries: Audit[]; onViewAll: () => void }) {
  const [open, setOpen] = useState(false);
  // Audit events are membership-scoped by the existing API. This is a recent activity feed,
  // not an unverified unread count or a browser push notification.
  const recent = entries.slice(0, 8);
  return <>
    <button className="icon-button" aria-label="Recent team activity" title="Recent team activity" onClick={()=>setOpen(true)}><Bell size={18}/></button>
    {open && <Modal title="Recent team activity" onClose={()=>setOpen(false)}>
      <p className="field-help">Your shared workspace activity, from the saved audit history. Updates automatically when the workspace is visible; open settings and editing dialogs pause background refresh.</p>
      {recent.length ? <div className="audit-list">{recent.map(event=><div className="settings-member-row" key={event.id}>
        <Activity size={17}/>
        <div className="settings-member-name"><strong>{event.summary}</strong><small>{event.actor_name} · {new Date(event.created_at).toLocaleString()}</small></div>
        <span className="version-label">v{event.plan_version}</span>
      </div>)}</div> : <p>No activity has been recorded in this workspace yet.</p>}
      <div className="dialog-actions"><button className="secondary" onClick={()=>{setOpen(false);onViewAll();}}>Open audit log</button><button className="primary" onClick={()=>setOpen(false)}>Close activity</button></div>
    </Modal>}
  </>;
}
