"use client";
import { useState } from "react";
import { api, type Overview, type Task } from "@/lib/api";
import { Modal, Busy } from "./ui";
export function TaskManager({ data, task, onClose, onSaved }: { data: Overview; task?: Task; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title,setTitle]=useState(task?.title ?? ""), [key,setKey]=useState(""), [description,setDescription]=useState(task?.description ?? ""), [owner,setOwner]=useState(data.members.find(m=>m.role!=="viewer")?.id ?? ""), [hours,setHours]=useState(8), [due,setDue]=useState(""), [pending,setPending]=useState(false), [error,setError]=useState("");
  async function save(archive=false) {
    setPending(true);setError("");
    try {
      await api(task ? `/tasks/${task.id}/${archive?"archive":"edit"}` : `/projects/${data.project.id}/tasks`, { method:"POST",body:JSON.stringify(task ? {title,description,expected_version:task.version,base_plan_version:data.plan_version} : {key,title,description,owner_id:owner,estimate_hours:hours,due_at:due?new Date(due).toISOString():null,base_plan_version:data.plan_version}) });
      await onSaved();onClose();
    } catch(e){setError((e as Error).message);} finally{setPending(false);}
  }
  return <Modal title={task?"Edit task details":"Create task"} onClose={onClose}>
    <p>{task?"Changes to ownership, priority and sequence require a separate reviewed proposal.":"Create a persisted task in this workspace. Dependencies can be proposed from the graph."}</p>
    <div className="form-grid">
      {!task && <label>Task key<input value={key} onChange={e=>setKey(e.target.value.toUpperCase())} placeholder="TASK-108" maxLength={30}/></label>}
      <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={140}/></label>
      <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1500}/></label>
      {!task && <><label>Owner<select value={owner} onChange={e=>setOwner(e.target.value)}>{data.members.filter(m=>m.role!=="viewer").map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Estimated hours<input type="number" min={1} max={160} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label><label>Due date (your timezone)<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label></>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="dialog-actions"><button className="primary" disabled={pending||!title.trim()||(!task&&!/^[A-Z][A-Z0-9-]{2,29}$/.test(key))} onClick={()=>save()}>{pending?<Busy/>:task?"Save details":"Create task"}</button>{task && <button className="secondary" disabled={pending} onClick={()=>save(true)}>Archive task</button>}</div>
    {task && <p className="field-help">Archive preserves audit history. Only unconnected tasks that are todo or completed can be archived.</p>}
  </Modal>;
}
