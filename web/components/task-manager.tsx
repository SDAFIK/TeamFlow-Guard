"use client";

import { useState } from "react";
import { api, type Overview, type Task } from "@/lib/api";
import { suggestTaskKey } from "@/domain/task-key";
import { Modal, Busy } from "./ui";

type SavedAction = "created" | "updated" | "archived";

export function TaskManager({
  data,
  task,
  onClose,
  onSaved,
}: {
  data: Overview;
  task?: Task;
  onClose: () => void;
  onSaved: (action: SavedAction) => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [key, setKey] = useState(() => task ? "" : suggestTaskKey(data.tasks.map((entry) => entry.key)));
  const [description, setDescription] = useState(task?.description ?? "");
  const [owner, setOwner] = useState(data.members.find((member) => member.role !== "viewer")?.id ?? "");
  const [hours, setHours] = useState(8);
  const [due, setDue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const validKey = /^[A-Z][A-Z0-9-]{2,29}$/.test(key);
  const canSave = title.trim().length > 0 && (Boolean(task) || (validKey && owner !== "" && Number.isFinite(hours) && hours >= 1 && hours <= 160));

  async function save(archive = false) {
    if (pending || (!archive && !canSave)) return;
    setPending(true);
    setError("");
    try {
      await api(
        task ? `/tasks/${task.id}/${archive ? "archive" : "edit"}` : `/projects/${data.project.id}/tasks`,
        {
          method: "POST",
          body: JSON.stringify(task
            ? { title: title.trim(), description, expected_version: task.version, base_plan_version: data.plan_version }
            : { key, title: title.trim(), description, owner_id: owner, estimate_hours: hours, due_at: due ? new Date(due).toISOString() : null, base_plan_version: data.plan_version }),
        },
      );
      await onSaved(archive ? "archived" : task ? "updated" : "created");
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={task ? "Edit task details" : "Create a task"} onClose={onClose}>
      <p>{task
        ? "Ownership and sequence changes go through a separate human-reviewed proposal."
        : "Start with a clear task. Your team can connect it to other work as the project grows."}</p>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="form-grid">
          {!task && <label>
            Task ID
            <input value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} placeholder="TASK-001" maxLength={30} pattern="[A-Z][A-Z0-9-]{2,29}" required aria-describedby="task-key-hint" />
            <small id="task-key-hint" className="field-help">Suggested automatically. You can change it to match your team&apos;s naming system.</small>
          </label>}
          <label>
            Task title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Finish checkout integration" maxLength={140} required autoFocus />
          </label>
          <label>
            Description (optional)
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does done look like?" maxLength={1500} />
          </label>
          {!task && <>
            <label>Task owner
              <select value={owner} onChange={(event) => setOwner(event.target.value)} required>
                {data.members.filter((member) => member.role !== "viewer").map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>Estimated effort (hours)
              <input type="number" min={1} max={160} value={hours} onChange={(event) => setHours(Number(event.target.value))} required />
            </label>
            <label>Target deadline (optional)
              <input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
            </label>
          </>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="primary" type="submit" disabled={pending || !canSave}>{pending ? <Busy /> : task ? "Save task details" : "Create task"}</button>
          {task && <button className="secondary" type="button" disabled={pending} onClick={() => setConfirmArchive(true)}>Archive task</button>}
        </div>
        {task && confirmArchive && <div className="archive-confirm" role="group" aria-label="Confirm archiving this task">
          <strong>Archive {task.key}?</strong>
          <p>This removes the task from the active board. Its decision and audit history stay available. Connected tasks cannot be archived.</p>
          <div className="dialog-actions">
            <button type="button" className="secondary" disabled={pending} onClick={() => setConfirmArchive(false)}>Keep task</button>
            <button type="button" className="danger-button" disabled={pending} onClick={() => void save(true)}>{pending ? <Busy/> : "Confirm archive"}</button>
          </div>
        </div>}
        {task && <p className="field-help">Archiving preserves audit history. Only eligible tasks without connected dependencies can be archived.</p>}
      </form>
    </Modal>
  );
}
