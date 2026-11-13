"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  FileText,
  GitBranch,
} from "lucide-react";
import {
  api,
  type Task,
  type Overview,
  type Risk,
  type Proposal,
  type Action,
  type Integrations,
  type Graph,
} from "@/lib/api";
import { dependencyFeedback } from "@/domain/dependency-feedback";
import { Modal, Badge, Busy, statusLabels } from "./ui";
import { JourneySteps } from './journey-steps';
import type { RecoveryOption } from '@/domain/recovery-options';
import type { simulateRecovery } from '@/domain/tic-v2-recovery';
type RecoverySimulation=ReturnType<typeof simulateRecovery>[number];

type Member = Overview["members"][number];
export function TaskDialog({
  task,
  data,
  onClose,
  onSaved,
  userId,
  onManage,
}: {
  task: Task;
  data: Overview;
  onClose: () => void;
  onSaved: () => Promise<void>;
  userId: string;
  onManage?: () => void;
}) {
  const [status, setStatus] = useState(task.status),
    [note, setNote] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [reviewer, setReviewer] = useState(task.reviewer_id ?? ""),
    [priority, setPriority] = useState(task.priority);
  const [owner, setOwner] = useState(task.owner_id), [due, setDue] = useState("");
  const canEdit =
    data.project.role !== "viewer" && task.status !== "done" &&
    (data.project.role === "lead" || task.owner_id === userId);
  const needsBlockerNote = status === "blocked" && !note.trim() && task.status !== "blocked";
  async function save() {
    setPending(true);
    setError("");
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, expected_version: task.version, note }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function propose() {
    setPending(true);
    setError("");
    const actions: Action[] = [];
    if (onManage && owner !== task.owner_id) actions.push({task_id:task.id,field:"owner_id",before:task.owner_id,after:owner});
    if (onManage && due) actions.push({task_id:task.id,field:"due_at",before:task.due_at ?? null,after:new Date(due).toISOString()});
    if (reviewer && reviewer !== task.reviewer_id)
      actions.push({
        task_id: task.id,
        field: "reviewer_id",
        before: task.reviewer_id,
        after: reviewer,
      });
    if (priority !== task.priority)
      actions.push({
        task_id: task.id,
        field: "priority",
        before: task.priority,
        after: priority,
      });
    try {
      await api(`/projects/${data.project.id}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          title: `Update ${task.key} review plan`,
          base_plan_version: data.plan_version,
          actions,
        }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title={task.title} onClose={onClose}>
      {onManage && <button className="secondary" onClick={onManage}>Edit task details</button>}
      <div className="dialog-meta">
        <span className="mono">{task.key}</span>
        <Badge value={task.status} />
        <span>Version {task.version}</span>
      </div>
      <p className="dialog-description">{task.description}</p>
      {task.due_at && <p className="field-help">Target deadline: {new Date(task.due_at).toLocaleString()}</p>}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="field-grid">
        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Task["status"])}
            disabled={!canEdit || pending}
          >
            {Object.entries(statusLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assignee
          <input
            readOnly
            value={
              data.members.find((m) => m.id === task.owner_id)?.name ??
              "Unassigned"
            }
          />
        </label>
      </div>
      {status === "blocked" && (
        <label className="field">
          Blocker note
          <textarea
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is preventing this task from moving forward?"
            required={task.status !== "blocked"}
          />
          <small className="field-help">Give teammates enough context to understand the blocker. No private details are required.</small>
        </label>
      )}
      <button
        className="primary"
        disabled={!canEdit || status === task.status || needsBlockerNote || pending}
        onClick={save}
      >
        {pending ? <Busy /> : "Save status"}
      </button>
      {!canEdit && (
        <p className="field-help">
          {task.status === "done"
            ? "Completed work is preserved."
            : "Only the assignee or a project lead can change status."}
        </p>
      )}
      <div className="dialog-section">
        <h3>Propose a plan change</h3>
        {onManage && <div className="form-grid"><label>Proposed owner<select value={owner} onChange={e=>setOwner(e.target.value)}>{data.members.filter(m=>m.role!=="viewer").map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Proposed due date (your timezone)<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><p className="field-help">Current due date: {task.due_at ? new Date(task.due_at).toLocaleString() : "Not set"}</p></div>}
        <p>Review and priority changes require lead approval.</p>
        <div className="field-grid">
          <label>
            PR reviewer
            <select
              disabled={task.status === "done" || pending}
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            >
              {!task.reviewer_id && <option value="">No reviewer assigned</option>}
              {data.members
                .filter((m) => m.role !== "viewer")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.available_hours}h available
                  </option>
                ))}
            </select>
          </label>
          <label>
            Priority
            <select
              disabled={task.status === "done" || pending}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {["normal", "high", "critical"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="secondary"
          disabled={
            pending ||
            data.project.role === "viewer" || task.status === "done" ||
            ((reviewer === (task.reviewer_id ?? "")) &&
              priority === task.priority && owner === task.owner_id && !due)
          }
          onClick={propose}
        >
          Create proposal
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
export function RiskDialog({
  risk,
  tasks,
  integrations,
  readOnly = false,
  onClose,
  onProposal,
}: {
  risk: Risk;
  tasks: Task[];
  integrations: Integrations;
  readOnly?: boolean;
  onClose: () => void;
  onProposal: (p: Proposal) => Promise<void>;
}) {
  const [pending, setPending] = useState(""),
    [error, setError] = useState("");
  const [stage,setStage]=useState<'understand'|'compare'>('understand');
  const [options,setOptions]=useState<RecoveryOption[]>([]);
  const [simulations,setSimulations]=useState<RecoverySimulation[]>([]);
  async function compare() {
    setPending('options');setError('');
    try { const result=await api<{options:RecoveryOption[];simulations?:RecoverySimulation[]}>(`/risks/${risk.id}/recovery-options`);setOptions(result.options);setSimulations(result.simulations??[]);setStage('compare'); }
    catch(e){setError((e as Error).message);}finally{setPending('');}
  }
  async function analyze(mode: string, strategy?: string) {
    setPending(mode);
    setError("");
    try {
      const result = await api<Proposal>(
        `/risks/${risk.id}/analyze?mode=${mode}${strategy?`&strategy=${encodeURIComponent(strategy)}`:''}`,
        { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      await onProposal(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
    }
  }
  return (
    <Modal title={stage==='understand'?"Risk evidence & recovery":"Compare recovery options"} onClose={onClose} wide>
      <JourneySteps current={stage==='understand'?0:1}/>
      <div className="dialog-meta">
        <Badge value={risk.severity} />
        <span className="source-tag">
          {["replay", "seed"].includes(risk.evidence.origin)
            ? "Labeled sample event"
            : "Observed project event"}
        </span>
      </div>
      <h3 className="risk-title">{risk.evidence.title}</h3>
      <a className="text-link" href={`/risks/${risk.id}`}>Open risk permalink</a>
      <p>{risk.reason}</p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {stage==='understand'&&<div className="review-grid">
        <section className="evidence-card">
          <span className="section-kicker">OBSERVED EVIDENCE</span>
          <h3>
            <FileText size={18} />
            Source record
          </h3>
          <p>{risk.evidence.detail || 'A task status change produced this signal. Review the current task and its dependencies.'}</p>
          <dl>
            <dt>Source ID</dt>
            <dd className="mono">{risk.evidence.id}</dd>
            <dt>Observed</dt>
            <dd>{new Date(risk.evidence.observed_at).toLocaleString()}</dd>
          </dl>
          {risk.stale_evidence && (
            <div className="warning">
              Evidence is older than 72 hours. Verify freshness before deciding.
            </div>
          )}
        </section>
        <section className="evidence-card">
          <span className="section-kicker">DERIVED FROM THE GRAPH</span>
          <h3>
            <GitBranch size={18} />
            Downstream impact
          </h3>
          <div className="affected-list">
            {risk.affected_task_ids.map((id) => {
              const t = tasks.find((t) => t.id === id);
              return (
                <div key={id}>
                  <span>{t?.title ?? id}</span>
                  <small>{t?.key}</small>
                </div>
              );
            })}
            {!risk.affected_task_ids.length && (
              <p>No unfinished downstream tasks.</p>
            )}
          </div>
        </section>
      </div>}
      {stage==='compare'&&<section aria-label="Recovery alternatives">
        <p>These choices come from plan constraints and reported availability. Compare the tradeoffs, then review one change. AI can explain and select from the same allowed actions.</p>
        <div className="recovery-options">{options.map(option=><article className="recovery-option" key={option.id}><span className="section-kicker">RULE-BASED OPTION</span><h3>{option.title}</h3><p>{option.effect}</p><p className="option-tradeoff"><strong>Tradeoff:</strong> {option.tradeoff}</p>{simulations.filter(s=>s.id===option.id).map(s=><div key={s.id}><p><strong>Simulation:</strong> {s.affected_task_ids.length} unfinished dependent tasks. Source risk is not resolved by this action.</p>{s.capacity.map(c=><p key={c.member_id}>Estimated workload: {c.before_hours}h → {c.after_hours}h; {c.available_hours}h reported available.</p>)}<p className="field-help">No guaranteed delay reduction.</p></div>)}<button className="secondary" aria-label={`Review ${option.title}`} disabled={readOnly||!!pending} onClick={()=>analyze('rules',option.id)}>Review this option<ArrowRight size={16}/></button></article>)}</div>
        {simulations.filter(s=>!s.feasible).map(s=><p className="warning" key={s.id}>{s.title} is unavailable: {s.explanation}</p>)}
        {!options.length&&<p className="warning">No feasible plan change remains for this risk. If this is a demo, start a fresh AI rehearsal from TIC Intelligence. Otherwise refresh evidence or discuss the constraint with your team.</p>}
        <button className="text-link" disabled={!!pending} onClick={()=>setStage('understand')}>Back to evidence & impact</button>
      </section>}
      <div className="human-note">
        <ShieldCheck size={18} />
        <span>
          Analysis produces a proposal. No task owner, priority or dependency
          changes before approval.
        </span>
      </div>
      <div className="dialog-actions">
        {stage==='understand'&&<button className="primary" disabled={!!pending||!risk.active||risk.stale_evidence} onClick={()=>void compare()}>{pending==='options'?<Busy text="Checking options…"/>:<>Compare recovery options<ArrowRight size={17}/></>}</button>}
        {stage==='compare'&&<>
        <button
          className="primary"
          disabled={readOnly || !!pending || !risk.active || !integrations.ai_configured || !options.length}
          onClick={() => analyze(integrations.ai_provider ?? "gemini")}
        >
          {pending === (integrations.ai_provider ?? "gemini") ? (
            <Busy text="Analyzing evidence…" />
          ) : (
            <>
              <Sparkles size={17} />
              Analyze with {integrations.ai_provider === "gemini" ? "Gemini" : "OpenAI"}
            </>
          )}
        </button>
        <button
          className="secondary"
          disabled={readOnly || !!pending || !risk.active || !options.length}
          onClick={() => analyze("rules",options[0]?.id)}
        >
          {pending === "rules" ? <Busy /> : "Use recommended rule-based option"}
        </button>
        </>}
      </div>
      {!integrations.ai_configured && (
        <p className="field-help">
          AI is not configured yet. Rule-based recovery is available and
          will be explicitly labeled.
        </p>
      )}
    </Modal>
  );
}
export function ProposalDialog({
  proposal,
  data,
  sourceRisk,
  onClose,
  onDecided,
}: {
  proposal: Proposal;
  data: Overview;
  sourceRisk?: Risk;
  onClose: () => void;
  onDecided: (decision: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(""),
    [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const canApprove =
    data.project.role === "lead" &&
    proposal.status === "pending" &&
    !proposal.stale;
  function display(action: Action, value: string | number | null) {
    if (value === null) return "Not assigned";
    if (action.field === "reviewer_id" || action.field === "owner_id")
      return data.members.find((m) => m.id === value)?.name ?? String(value);
    if (action.field === "dependency")
      return data.tasks.find((t) => t.id === value)?.title ?? String(value);
    if (action.field === "position") return `Position ${Number(value) + 1}`;
    if (action.field === "due_at") {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    return String(value);
  }
  const fieldName: Record<Action["field"], string> = {
    reviewer_id: "PR reviewer", owner_id: "Task owner", due_at: "Target deadline",
    priority: "Priority", dependency: "Required predecessor", position: "Task sequence",
  };
  async function decide(decision: string) {
    setPending(decision);
    setError("");
    try {
      await api(`/proposals/${proposal.id}/decision`, {
        method: "POST",
        headers: { "Idempotency-Key": `${key}-${decision}` },
        body: JSON.stringify({
          decision,
          base_plan_version: proposal.base_plan_version,
        }),
      });
      await onDecided(decision);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending("");
    }
  }
  return (
    <Modal title="Review recovery proposal" onClose={onClose} wide>
      <JourneySteps current={2}/>
      <div className="dialog-meta">
        <Badge value={proposal.stale ? "stale" : proposal.status} />
        <span>
          {["openai", "gemini"].includes(proposal.source)
            ? `${proposal.source === "gemini" ? "Gemini" : "OpenAI"} analysis`
            : proposal.source === "rules"
              ? "Rule-based suggestion · no AI call"
              : "Team proposal"}
        </span>
        <span>Based on plan v{proposal.base_plan_version}</span>
      </div>
      <h3 className="risk-title">{proposal.title}</h3>
      <a className="text-link" href={`/decisions/${proposal.id}`}>Open proposal permalink</a>
      <p>{proposal.explanation}</p>
      {sourceRisk&&<details className="proposal-evidence"><summary>Evidence behind this proposal</summary><p><strong>{sourceRisk.evidence.title}</strong></p><p>{sourceRisk.reason}</p><p>{sourceRisk.evidence.origin==='seed'||sourceRisk.evidence.origin==='replay'?'Labeled sample evidence':'Observed project evidence'} · {new Date(sourceRisk.evidence.observed_at).toLocaleString()}</p><span className="mono">{sourceRisk.id}</span></details>}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {proposal.stale && (
        <div className="warning">
          <TriangleAlert size={18} />
          The plan has changed. Generate a new proposal from the risk before
          approving.
        </div>
      )}
      <div className="diff-table">
        <div className="diff-header">
          <span>PROPOSED CHANGE</span>
          <span>BEFORE</span>
          <span>AFTER</span>
        </div>
        {proposal.actions.map((a, i) => (
          <div className="diff-row" key={i}>
            <div>
              <b>{data.tasks.find((t) => t.id === a.task_id)?.title}</b>
              <small>{fieldName[a.field]}</small>
            </div>
            <span>{display(a, a.before)}</span>
            <strong>{display(a, a.after)}</strong>
          </div>
        ))}
      </div>
      <div className="assumptions">
        <h3>Check before applying</h3>
        <ul>
          {proposal.assumptions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="human-note">
        <ShieldCheck size={18} />
        <span>
          Approval is validated against the current plan and recorded in the
          audit log. It does not clear failed CI.
        </span>
      </div>
      <div className="dialog-actions">
        <button
          className="primary"
          disabled={!canApprove || !!pending}
          onClick={() => decide("approve")}
        >
          {pending === "approve" ? (
            <Busy text="Applying safely…" />
          ) : (
            <>
              <Check size={18} />
              Approve & apply
            </>
          )}
        </button>
        <button
          className="secondary"
          disabled={
            data.project.role !== "lead" ||
            proposal.status !== "pending" ||
            !!pending
          }
          onClick={() => decide("reject")}
        >
          {pending === "reject" ? <Busy /> : "Reject proposal"}
        </button>
      </div>
      {data.project.role !== "lead" && (
        <p className="field-help">
          You can inspect this proposal. A project lead must approve or reject
          it.
        </p>
      )}
      {proposal.status !== "pending" && <p className="field-help">This proposal was already {proposal.status}. Its recorded decision is preserved in the audit log.</p>}
    </Modal>
  );
}
export function DependencyDialog({
  data,
  graph,
  initialPair,
  onClose,
  onSaved,
}: {
  data: Overview;
  graph: Graph;
  initialPair?:{source:string;target:string}|null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const candidates = data.tasks.filter((task) => task.status !== "done");
  const [before, setBefore] = useState(initialPair?.source??data.tasks[0]?.id??""),
    [after, setAfter] = useState(initialPair?.target??candidates.find((task) => task.id !== (initialPair?.source??data.tasks[0]?.id))?.id??""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const guidance = dependencyFeedback(data.tasks.map(t=>t.id), graph.edges, before, after);
  async function submit() {
    if (guidance || pending) return;
    setPending(true);
    setError("");
    try {
      await api(`/projects/${data.project.id}/dependencies/validate`, {
        method: "POST",
        body: JSON.stringify({ predecessor_id: before, successor_id: after }),
      });
      await api(`/projects/${data.project.id}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          title: "Update task dependency",
          base_plan_version: data.plan_version,
          actions: [
            {
              task_id: after,
              field: "dependency",
              before: null,
              after: before,
            },
          ],
        }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title="Propose a dependency" onClose={onClose}>
      <p>
        Show which task must finish first. This creates a proposal for a team lead to review; it does not change the plan yet.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="field-grid">
        <label>
          Predecessor
          <select value={before} onChange={(e) => setBefore(e.target.value)} disabled={pending}>
            {data.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dependent task
          <select value={after} onChange={(e) => setAfter(e.target.value)} disabled={pending}>
            <option value="">Choose a task…</option>
            {candidates
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="dependency-preview" aria-live="polite">
        {guidance ? <p className="field-help">{guidance}</p> : <p><strong>{data.tasks.find(t=>t.id===before)?.title}</strong> must finish before <strong>{data.tasks.find(t=>t.id===after)?.title}</strong>.</p>}
        <small>Cycle checks run here for immediate feedback and again on the server.</small>
      </div>
      <div className="dialog-actions"><button className="primary" disabled={pending || Boolean(guidance)} onClick={submit}>
        {pending ? <Busy /> : "Validate & create proposal"}
      </button><button className="secondary" disabled={pending} onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}
function localDate(value:Date):string{
 const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,"0"),d=String(value.getDate()).padStart(2,"0");
 return y+"-"+m+"-"+d;
}
function initialAvailabilityDate(value:string|null|undefined,fallback:Date):string{
 const date=value?new Date(value):fallback;
 return localDate(Number.isFinite(date.getTime())?date:fallback);
}
export function AvailabilityForm({
 member,projectId,onSaved,dated=false,
}: {member:Member & {availability_start?:string|null;availability_end?:string|null};projectId:string;onSaved:()=>Promise<void>;dated?:boolean}) {
 const [start,setStart]=useState(()=>initialAvailabilityDate(member.availability_start,new Date()));
 const [end,setEnd]=useState(()=>{const d=new Date();d.setDate(d.getDate()+2);return initialAvailabilityDate(member.availability_end,d);});
 const [hours,setHours]=useState(String(member.available_hours)),[pending,setPending]=useState(false),[error,setError]=useState("");
 const amount=Number(hours),validHours=hours.trim()!==""&&Number.isInteger(amount)&&amount>=0&&amount<=80;
 const validRange=!dated||(Boolean(start)&&Boolean(end)&&end>start);
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending||!validHours||!validRange)return;
  setPending(true);setError("");
  try{
   await api(`/projects/${projectId}/availability`,{method:"PUT",body:JSON.stringify({hours:amount,...(dated?{start_at:new Date(start+"T00:00:00").toISOString(),end_at:new Date(end+"T00:00:00").toISOString()}:{})})});
   await onSaved();
  }catch(e){setError((e as Error).message);}finally{setPending(false);}
 }
 return <form className="availability-form release-availability" onSubmit={save} aria-label="Your planning availability">
  <div className="availability-copy"><span className="section-kicker">VOLUNTARY CAPACITY</span><h3>Your available hours</h3><p>Share planning hours for a date range. No private reason or activity tracking is collected.</p></div>
  <div className="availability-fields">
   <label htmlFor="hours">Available hours<input id="hours" type="number" min={0} max={80} step={1} required value={hours} disabled={pending} onChange={e=>setHours(e.target.value)}/></label>
   {dated&&<><label>From (local date)<input type="date" value={start} required disabled={pending} onChange={e=>setStart(e.target.value)}/></label><label>Until (exclusive)<input type="date" value={end} min={start||undefined} required disabled={pending} onChange={e=>setEnd(e.target.value)}/></label></>}
   <button className="primary" type="submit" disabled={pending||!validHours||!validRange||(!dated&&amount===member.available_hours)}>{pending?<Busy/>:"Save availability"}</button>
  </div>
  {!validRange&&<p className="field-help" role="status">Choose an end date after the start date.</p>}
  {error&&<div className="error" role="alert">{error}</div>}
 </form>;
}
