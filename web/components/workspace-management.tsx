"use client";
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Modal, Busy } from './ui';

type Member={id:string;name:string;email:string;role:'owner'|'manager'|'member'|'viewer'};
type Settings={id:string;name:string;description:string;tracked_branch:string;review_threshold_hours:number;plan_version:number;my_role:Member['role'];members:Member[]};
type Invitation={id:string;email:string;role:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};

export function WorkspaceSetup({onClose,onSaved,displayName}:{onClose:()=>void;onSaved:(id:string)=>Promise<void>;displayName:string}){
  const [mode,setMode]=useState<'create'|'join'>(()=>typeof window!=='undefined'&&window.location.pathname==='/join'?'join':'create');
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[person,setPerson]=useState(displayName),[token,setToken]=useState(()=>typeof window==='undefined'?'':window.location.hash.slice(1)),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
    const input=mode==='create'?{name,description,display_name:person}:{token:token.includes('#')?token.split('#').at(-1):token,display_name:person};
    const result=await api<{id:string}>(mode==='create'?'/projects':'/invitations/accept',{method:'POST',body:JSON.stringify(input)});
    await onSaved(result.id);onClose();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title="Your workspace" onClose={onClose}><div className="segmented"><button aria-pressed={mode==='create'} onClick={()=>setMode('create')}>Create workspace</button><button aria-pressed={mode==='join'} onClick={()=>setMode('join')}>Join with invitation</button></div>
    <p>{mode==='create'?'Start with an empty workspace. Add your own tasks and teammates; no sample risks or counts are added.':'Sign in with the email the invitation was sent to, then paste its link or code.'}</p>
    <form onSubmit={submit} className="form-grid"><label>Your display name<input value={person} onChange={e=>setPerson(e.target.value)} required maxLength={80}/></label>
      {mode==='create'?<><label>Workspace name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100}/></label><label>Workspace description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000}/></label></>:<label>Invitation link or code<input value={token} onChange={e=>setToken(e.target.value.trim())} required autoComplete="off"/></label>}
      {error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?<Busy/>:mode==='create'?'Create empty workspace':'Accept invitation'}</button>
    </form></Modal>;
}

export function WorkspaceSettings({id,onSaved}:{id:string;onSaved:()=>Promise<void>}){
  const [settings,setSettings]=useState<Settings|null>(null),[invites,setInvites]=useState<Invitation[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[email,setEmail]=useState(''),[role,setRole]=useState('member'),[link,setLink]=useState('');
  async function load(){const s=await api<Settings>(`/projects/${id}/settings`);setSettings(s);if(['owner','manager'].includes(s.my_role))setInvites(await api<Invitation[]>(`/projects/${id}/invitations`));}
  useEffect(()=>{let active=true;void api<Settings>(`/projects/${id}/settings`).then(async s=>{if(!active)return;setSettings(s);if(['owner','manager'].includes(s.my_role)){const rows=await api<Invitation[]>(`/projects/${id}/invitations`);if(active)setInvites(rows);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id]);
  async function perform(fn:()=>Promise<unknown>,message:string){setBusy(true);setError('');setNotice('');try{await fn();await load();await onSaved();setNotice(message);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(!settings)return <section className="panel settings-panel">{error?<p role="alert" className="error">{error}</p>:<Busy text="Loading workspace settings…"/>}</section>;
  const manager=['owner','manager'].includes(settings.my_role);
  return <><section className="panel settings-panel"><span className="section-kicker">WORKSPACE</span><h2>Make it your team’s workspace</h2>
    <form className="form-grid" onSubmit={e=>{e.preventDefault();void perform(()=>api(`/projects/${id}/settings`,{method:'PUT',body:JSON.stringify({name:settings.name,description:settings.description,tracked_branch:settings.tracked_branch,review_threshold_hours:settings.review_threshold_hours,base_plan_version:settings.plan_version})}),'Workspace settings saved. Risk rules use these values immediately.');}}>
      <label>Workspace name<input disabled={!manager||busy} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})} required minLength={2} maxLength={100}/></label>
      <label>Description<textarea disabled={!manager||busy} value={settings.description} onChange={e=>setSettings({...settings,description:e.target.value})} maxLength={1000}/></label>
      <label>Tracked Git branch<input disabled={!manager||busy} value={settings.tracked_branch} onChange={e=>setSettings({...settings,tracked_branch:e.target.value})} required maxLength={100}/></label>
      <label>PR review alert after (hours)<input type="number" min={1} max={168} disabled={!manager||busy} value={settings.review_threshold_hours} onChange={e=>setSettings({...settings,review_threshold_hours:Number(e.target.value)})} required/></label>
      {manager&&<button className="primary" disabled={busy}>Save workspace settings</button>}
    </form><p className="field-help">Changing planning settings invalidates pending proposals so they must be reviewed against the new context.</p>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status" className="success-banner">{notice}</p>}
  </section><section className="panel settings-panel"><span className="section-kicker">PEOPLE & ACCESS</span><h2>Your team</h2>
    {settings.members.map(member=><div className="integration-row" key={member.id}><div><strong>{member.name}</strong><p>{member.email}</p></div>{settings.my_role==='owner'&&member.role!=='owner'?<select aria-label={`Role for ${member.name}`} disabled={busy} value={member.role} onChange={e=>void perform(()=>api(`/projects/${id}/members/${member.id}/role`,{method:'PUT',body:JSON.stringify({role:e.target.value})}),'Role updated.')}><option value="manager">Manager</option><option value="member">Member</option><option value="viewer">Viewer</option></select>:<span>{member.role}</span>}</div>)}
    {manager&&<><h3>Invite a teammate</h3><p>Generate a private, email-bound invitation. Share the link yourself; it expires in seven days.</p><form className="form-grid" onSubmit={e=>{e.preventDefault();void perform(async()=>{const result=await api<{token:string}>(`/projects/${id}/invitations`,{method:'POST',body:JSON.stringify({email,role})});setLink(`${window.location.origin}/join#${result.token}`);setEmail('');},'Invitation created. Copy the link below.');}}><label>Teammate email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Invitation role<select value={role} onChange={e=>setRole(e.target.value)}><option value="member">Member — can update assigned tasks and propose changes</option><option value="viewer">Viewer — read only</option>{settings.my_role==='owner'&&<option value="manager">Manager — can approve changes</option>}</select></label><button className="secondary" disabled={busy}>Create invitation link</button></form>
      {link&&<label>Private invitation link<input readOnly value={link} onFocus={e=>e.target.select()}/><button className="text-link" onClick={()=>{void navigator.clipboard.writeText(link).then(()=>setNotice('Invitation link copied.')).catch(()=>setNotice('Select and copy the invitation link.'));}}>Copy invitation link</button></label>}
      {invites.map(invite=><div className="integration-row" key={invite.id}><div><strong>{invite.email}</strong><p>{invite.role} · {invite.accepted_at?'Accepted':invite.revoked_at?'Revoked':`Expires ${new Date(invite.expires_at).toLocaleDateString()}`}</p></div>{!invite.accepted_at&&!invite.revoked_at&&<button className="text-link" disabled={busy} onClick={()=>void perform(()=>api(`/projects/${id}/invitations/${invite.id}/revoke`,{method:'POST'}),'Invitation revoked.')}>Revoke invitation</button>}</div>)}
    </>}
  </section></>;
}
