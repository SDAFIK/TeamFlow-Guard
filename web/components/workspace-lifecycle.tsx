"use client";
import { useRef, useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { Busy, Modal } from "./ui";

export type LifecycleOperation = "archive" | "restore" | "delete";
type LifecycleProps = {id:string;name:string;archived:boolean;onChanged:(operation:LifecycleOperation,id:string)=>Promise<void>};

// A separate confirmation state prevents destructive actions from being triggered
// by ordinary settings saves or by accidentally pressing Enter on another form.
export function WorkspaceLifecycleActions({id,name,archived,onChanged}:LifecycleProps){
  const [action,setAction]=useState<LifecycleOperation|null>(null);
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const lock=useRef(false);
  function choose(next:LifecycleOperation){setAction(next);setConfirmation("");setError("");}
  async function submit(){
    if(!action||lock.current||(action==="delete"&&confirmation!==name))return;
    lock.current=true;setBusy(true);setError("");
    try{
      await api(`/projects/${id}/lifecycle`,{method:"POST",body:JSON.stringify(action==="delete"?{operation:action,confirmed_name:confirmation}:{operation:action})});
      setAction(null);setConfirmation("");
      await onChanged(action,id);
    }catch(e){setError((e as Error).message);}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="workspace-lifecycle-actions">
    {!action?<div className="dialog-actions">
      {archived?<button type="button" className="secondary" disabled={busy} onClick={()=>choose("restore")}><ArchiveRestore size={16}/> Restore workspace</button>:<button type="button" className="secondary" disabled={busy} onClick={()=>choose("archive")}><Archive size={16}/> Archive workspace</button>}
      <button type="button" className="secondary workspace-danger-button" disabled={busy} onClick={()=>choose("delete")}><Trash2 size={16}/> Delete workspace</button>
    </div>:<form className="form-grid workspace-lifecycle-confirm" aria-label={`Confirm ${action} workspace`} onSubmit={e=>{e.preventDefault();void submit();}}>
      <h3>{action==="delete"?"Permanently delete workspace?":action==="archive"?"Archive workspace?":"Restore workspace?"}</h3>
      <p>{action==="delete"?`This permanently removes ${name}, including its tasks, members, invitations, dependencies, risk evidence, AI proposals, audit history and learning data. It cannot be restored.`:action==="archive"?`Archive ${name}? It will leave the active workspace list and planning changes will be paused. Its data stays available for restoration.`:`Restore ${name} to the active workspace list. Members can resume work and protected proposals will be revalidated against the new plan version.`}</p>
      {action==="delete"&&<label>Type the workspace name exactly: <strong>{name}</strong><input aria-label="Confirm workspace name" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} required/></label>}
      <div className="dialog-actions">
        <button type="button" className="secondary" disabled={busy} onClick={()=>{setAction(null);setConfirmation("");setError("");}}>Cancel</button>
        <button type="submit" className={action==="delete"?"primary workspace-danger-button":"primary"} disabled={busy||(action==="delete"&&confirmation!==name)}>{busy?<Busy/>:action==="delete"?"Delete permanently":action==="archive"?"Confirm archive":"Confirm restore"}</button>
      </div>
    </form>}
    {error&&<p className="error" role="alert">{error}</p>}
  </div>;
}

export function ArchivedWorkspaces({projects,onClose,onChanged}:{projects:Project[];onClose:()=>void;onChanged:LifecycleProps["onChanged"]}){
  return <Modal title="Archived workspaces" onClose={onClose}>
    <p>Archived workspaces are read-only and excluded from the active workspace switcher. Owners can restore or permanently delete them.</p>
    {projects.length===0?<p>No archived workspaces.</p>:projects.map(p=><section className="panel settings-panel" key={p.id}>
      <h3>{p.name}</h3><p>{p.is_demo?"Demo workspace · ":""}{p.is_owner?"Owner":"Member"} · Archived</p>
      {p.is_owner?<WorkspaceLifecycleActions id={p.id} name={p.name} archived onChanged={onChanged}/>:<p className="field-help">Only a workspace owner can restore or delete this workspace.</p>}
    </section>)}
  </Modal>;
}
