"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Check, ClipboardCopy, LockKeyhole, MailPlus, Send, ShieldCheck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Busy } from "./ui";
import { GithubConnection } from "./github-connection";

type Role = "owner" | "manager" | "member" | "viewer";
type Member = { id: string; name: string; email: string; role: Role };
type Settings = {
  id: string; name: string; description: string; tracked_branch: string;
  review_threshold_hours: number; plan_version: number; my_role: Role; members: Member[];
};
type Invitation = {
  id: string; email: string; role: Role; expires_at: string;
  accepted_at: string | null; revoked_at: string | null;
};

const roleExplainers: Record<Exclude<Role, "owner">, string> = {
  manager: "Can manage planning and approve protected changes",
  member: "Can update assigned work and propose changes",
  viewer: "Read-only access",
};

export function WorkspaceSettings({ id, onSaved }: { id: string; onSaved: () => Promise<void> }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "owner">>("member");
  const [link, setLink] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [roleChange, setRoleChange] = useState<{ id: string; name: string; role: Exclude<Role, "owner"> } | null>(null);
  const [refreshedAt, setRefreshedAt] = useState(0);

  const load = useCallback(async () => {
    const next = await api<Settings>(`/projects/${id}/settings`);
    setSettings(next);
    if (next.my_role === "owner" || next.my_role === "manager") {
      setInvites(await api<Invitation[]>(`/projects/${id}/invitations`));
    } else {
      setInvites([]);
    }
    setRefreshedAt(Date.now());
  }, [id]);

  useEffect(() => {
    let active = true;
    void api<Settings>(`/projects/${id}/settings`).then(async next => {
      if (!active) return;
      setSettings(next);
      if (next.my_role === "owner" || next.my_role === "manager") {
        const rows = await api<Invitation[]>(`/projects/${id}/invitations`);
        if (active) setInvites(rows);
      }
      if (active) setRefreshedAt(Date.now());
    }).catch(cause => {
      if (active) setError((cause as Error).message);
    });
    return () => { active = false; };
  }, [id]);

  async function perform(action: () => Promise<void>, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await action();
      setNotice(message);
      const results = await Promise.allSettled([load(), onSaved()]);
      if (results.some(result => result.status === "rejected")) {
        setError("The change was saved, but the latest workspace data could not be refreshed. Use Refresh to try again.");
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return (
    <section className="panel settings-panel">
      <h2>Workspace settings</h2>
      {error ? <><p className="error" role="alert">{error}</p><button className="secondary" onClick={() => void load().catch(cause => setError((cause as Error).message))}>Retry loading</button></> : <Busy text="Loading workspace settings…"/>}
    </section>
  );

  const manager = settings.my_role === "owner" || settings.my_role === "manager";
  const owner = settings.my_role === "owner";

  return (
    <>
      <section className="panel settings-panel">
        <div className="settings-section-header">
          <span className="section-kicker">WORKSPACE DETAILS</span>
          <h2>Make this your team&apos;s space</h2>
          <p>Keep project information and delivery rules up to date.</p>
        </div>
        <form className="form-grid settings-form-grid" onSubmit={event => {
          event.preventDefault();
          void perform(async () => {
            await api(`/projects/${id}/settings`, {
              method: "PUT",
              body: JSON.stringify({
                name: settings.name,
                description: settings.description,
                tracked_branch: settings.tracked_branch,
                review_threshold_hours: settings.review_threshold_hours,
                base_plan_version: settings.plan_version,
              }),
            });
          }, "Workspace settings saved. Risk rules now use the new values.");
        }}>
          <label className="form-full">Workspace name
            <input disabled={!manager || busy} value={settings.name} onChange={event => setSettings({...settings,name:event.target.value})} minLength={2} maxLength={100} required/>
          </label>
          <label className="form-full">What is this workspace for?
            <textarea disabled={!manager || busy} value={settings.description} onChange={event => setSettings({...settings,description:event.target.value})} maxLength={1000} placeholder="A short purpose for teammates joining later"/>
          </label>
          <label>Tracked Git branch
            <input disabled={!manager || busy} value={settings.tracked_branch} onChange={event => setSettings({...settings,tracked_branch:event.target.value})} maxLength={100} required/>
          </label>
          <label>PR review alert after (hours)
            <input type="number" min={1} max={168} disabled={!manager || busy} value={settings.review_threshold_hours} onChange={event => setSettings({...settings,review_threshold_hours:Number(event.target.value)})} required/>
          </label>
          {manager && <button className="primary" disabled={busy} type="submit">{busy ? <Busy/> : <><Check size={17}/> Save workspace settings</>}</button>}
        </form>
        {!manager && <p className="field-help"><LockKeyhole size={14}/> Only workspace owners and managers can edit these settings.</p>}
        <p className="settings-caution">Changing planning settings makes previous pending proposals stale. They must be reviewed against the new plan.</p>
      </section>

      <section className="panel settings-panel" aria-labelledby="team-access-title">
        <div className="settings-section-header">
          <span className="section-kicker"><Users size={14}/> PEOPLE & ACCESS</span>
          <h2 id="team-access-title">Your team</h2>
          <p>{settings.members.length} {settings.members.length === 1 ? "member" : "members"} share this plan.</p>
        </div>
        <div className="settings-member-list">
          {settings.members.map(member => (
            <Fragment key={member.id}>
              <div className="settings-member-row">
                <span className="avatar">{member.name[0] || "?"}</span>
                <div className="settings-member-name"><strong>{member.name}</strong><small>{member.email}</small></div>
                {owner && member.role !== "owner" ?
                  <select aria-label={`Role for ${member.name}`} value={roleChange?.id === member.id ? roleChange.role : member.role} disabled={busy} onChange={event => setRoleChange({ id:member.id, name:member.name, role:event.target.value as Exclude<Role,"owner"> })}>
                    {(["manager","member","viewer"] as const).map(role => <option value={role} key={role}>{role.charAt(0).toUpperCase()+role.slice(1)}</option>)}
                  </select> :
                  <span className="settings-role-tag">{member.role}</span>
                }
              </div>
              {roleChange?.id === member.id && roleChange.role !== member.role && (
                <div className="role-change-confirm" role="group" aria-label={`Confirm ${member.name}'s access change`}>
                  <p><ShieldCheck size={16}/> Give <strong>{member.name}</strong> {roleChange.role} access? {roleExplainers[roleChange.role]}.</p>
                  <div className="dialog-actions">
                    <button className="secondary" disabled={busy} onClick={() => setRoleChange(null)}>Cancel</button>
                    <button className="primary" disabled={busy} onClick={() => void perform(async () => {
                      await api(`/projects/${id}/members/${member.id}/role`, {method:"PUT",body:JSON.stringify({role:roleChange.role})});
                      setRoleChange(null);
                    }, "Teammate access updated.")}>Confirm role change</button>
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
        {manager && (
          <div className="invite-panel">
            <div className="settings-section-header">
              <h3><MailPlus size={19}/> Invite a teammate</h3>
              <p>Invite someone by their email address. A private link is bound to that email and expires in seven days. You can send it using your own email app.</p>
            </div>
            <form className="form-grid" onSubmit={event => {
              event.preventDefault();
              void perform(async () => {
                const result = await api<{token:string}>(`/projects/${id}/invitations`, {method:"POST",body:JSON.stringify({email,role:inviteRole})});
                setLink(`${window.location.origin}/join#${result.token}`);
                setInvitedEmail(email.trim());
                setEmail("");
              }, "Invitation created. Copy and share the private link securely.");
            }}>
              <label>Teammate email
                <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@example.com" autoComplete="email" disabled={busy} required/>
              </label>
              <label>Access level
                <select value={inviteRole} onChange={event => setInviteRole(event.target.value as Exclude<Role,"owner">)} disabled={busy}>
                  <option value="member">Member — edit assigned tasks</option>
                  <option value="viewer">Viewer — read only</option>
                  {owner && <option value="manager">Manager — approve changes</option>}
                </select>
              </label>
              <button className="secondary" disabled={busy} type="submit"><MailPlus size={16}/> Generate invitation link</button>
            </form>
            {link && <div className="invitation-link">
              <label>Private invitation link<input readOnly value={link} onFocus={event => event.target.select()} aria-describedby="invitation-help"/></label>
              <button className="primary" onClick={() => void navigator.clipboard.writeText(link).then(() => setNotice("Invitation link copied.")).catch(() => setError("Clipboard is unavailable. Select the link and copy it manually."))}><ClipboardCopy size={16}/> Copy link</button>
              <a className="secondary invite-email-action" href={`mailto:${encodeURIComponent(invitedEmail)}?subject=${encodeURIComponent("Join my TeamFlow Guard workspace")}&body=${encodeURIComponent(`I've invited you to join our TeamFlow Guard workspace. Sign in using ${invitedEmail}, then open this private invitation link (expires in seven days):\n\n${link}\n\nPlease don't forward it.`)}`}><Send size={16}/> Open email draft</a>
              <p id="invitation-help">Only send this to the invited email owner. The link is shown until you leave the page.</p>
            </div>}
            {invites.length > 0 && <div className="pending-invitations"><h3>Recent invitations</h3>
              {invites.map(invite => {
                const expired = Date.parse(invite.expires_at) < refreshedAt;
                const status = invite.accepted_at ? "Accepted" : invite.revoked_at ? "Revoked" : expired ? "Expired" : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`;
                return <div className="settings-member-row" key={invite.id}>
                  <div className="settings-member-name"><strong>{invite.email}</strong><small>{invite.role} · {status}</small></div>
                  {!invite.accepted_at && !invite.revoked_at && !expired && <button className="text-link" disabled={busy} onClick={() => void perform(async () => {await api(`/projects/${id}/invitations/${invite.id}/revoke`,{method:"POST"});}, "Invitation revoked.")}>Revoke</button>}
                </div>;
              })}
            </div>}
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="success-banner" role="status"><Check size={16}/>{notice}</p>}
      </section>
      <GithubConnection workspaceId={id} planVersion={settings.plan_version} canManage={manager} onChanged={async () => { await load(); await onSaved(); }}/>
    </>
  );
}
