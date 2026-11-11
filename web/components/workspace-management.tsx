"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Modal, Busy } from "./ui";

type SetupMode = "create" | "join";

export function WorkspaceSetup({
  onClose,
  onSaved,
  displayName,
  initialMode = "create",
}: {
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
  displayName: string;
  initialMode?: SetupMode;
}) {
  const [mode, setMode] = useState<SetupMode>(initialMode);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState(displayName);
  const [invitation, setInvitation] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: SetupMode) {
    setMode(next);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const token = invitation.includes("#") ? invitation.split("#").at(-1) ?? "" : invitation.trim();
      if (mode === "join" && !/^[a-f0-9]{64}$/.test(token)) {
        throw new Error("Paste the complete invitation URL or the 64-character invitation code.");
      }
      const input = mode === "create"
        ? { name: name.trim(), description: description.trim(), display_name: person.trim() }
        : { token, display_name: person.trim() };
      const result = await api<{ id: string }>(
        mode === "create" ? "/projects" : "/invitations/accept",
        { method: "POST", body: JSON.stringify(input) },
      );
      await onSaved(result.id);
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Your workspace" onClose={onClose}>
      <div className="segmented" role="group" aria-label="Workspace setup">
        <button type="button" aria-pressed={mode === "create"} onClick={() => switchMode("create")}>Create workspace</button>
        <button type="button" aria-pressed={mode === "join"} onClick={() => switchMode("join")}>Join with invitation</button>
      </div>
      <p>{mode === "create"
        ? "Start with your team's real tasks. Your workspace will be empty until you add them."
        : "Sign in with the email the invitation was sent to, then paste your invitation link or code."}</p>
      <form onSubmit={submit} className="form-grid">
        <label>Your display name
          <input value={person} onChange={event => setPerson(event.target.value)}
            autoComplete="name" placeholder="What should your teammates call you?"
            required minLength={1} maxLength={80} disabled={busy}/>
        </label>
        {mode === "create" ? (
          <>
            <label>Workspace name
              <input value={name} onChange={event => setName(event.target.value)}
                placeholder="Example: Mobile app release" required minLength={2} maxLength={100} disabled={busy}/>
            </label>
            <label>What is your team building? (optional)
              <textarea value={description} onChange={event => setDescription(event.target.value)}
                placeholder="A short shared goal for your workspace" maxLength={1000} disabled={busy}/>
            </label>
          </>
        ) : (
          <label>Invitation URL or code
            <input value={invitation} onChange={event => setInvitation(event.target.value.trim())}
              placeholder="Paste the private invitation URL" autoComplete="off" required disabled={busy}/>
            <small className="field-help">Invitation links are email-bound and expire in seven days.</small>
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy} type="submit">
          {busy ? <Busy/> : mode === "create" ? "Create empty workspace" : "Accept invitation"}
        </button>
      </form>
    </Modal>
  );
}
