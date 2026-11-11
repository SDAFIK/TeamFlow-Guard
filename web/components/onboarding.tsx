"use client";

import {
  ArrowRight,
  Check,
  GitBranch,
  Layers3,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getSetupProgress, type SetupAction, type SetupSnapshot } from "@/domain/onboarding";

export function EmptyWorkspaceWelcome({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <section className="onboard-welcome" aria-labelledby="onboard-title">
      <div className="onboard-welcome-copy">
        <span className="onboard-eyebrow"><Sparkles size={15} /> YOUR TEAM, ONE CLEAR PLAN</span>
        <h1 id="onboard-title">Keep projects moving, even when plans change.</h1>
        <p>
          Bring your tasks, teammates and dependencies together. When a risk appears,
          TeamFlow Guard helps your team understand the impact and review a recovery plan.
        </p>
        <div className="onboard-welcome-actions">
          <button className="primary" onClick={onCreate}><Plus size={17} /> Create a workspace <ArrowRight size={16} /></button>
          <button className="secondary" onClick={onJoin}>Join an existing team</button>
        </div>
        <p className="onboard-privacy"><ShieldCheck size={16} /> Your workspace begins empty. No sample results are presented as real activity.</p>
      </div>
      <div className="onboard-preview" aria-label="How TeamFlow Guard works">
        <div className="onboard-preview-heading"><span>YOUR DELIVERY LOOP</span><span className="onboard-preview-dot" /></div>
        <ol>
          <li><span className="onboard-preview-icon"><Layers3 size={19}/></span><div><strong>Plan together</strong><small>Tasks, owners and deadlines</small></div></li>
          <li><span className="onboard-preview-icon"><GitBranch size={19}/></span><div><strong>See connected impact</strong><small>Know what a delay affects</small></div></li>
          <li><span className="onboard-preview-icon"><ShieldCheck size={19}/></span><div><strong>Decide with confidence</strong><small>Human approval before plan changes</small></div></li>
        </ol>
        <p>Start with your real project. We&apos;ll guide you through setup.</p>
      </div>
    </section>
  );
}

const steps = [
  { id: "plan", title: "Add your first task", description: "Give work a clear title, owner and deadline.", icon: Layers3 },
  { id: "team", title: "Bring in a teammate", description: "Invite someone to see the same project plan.", icon: Users },
  { id: "connect", title: "Link dependent work", description: "Show which tasks must finish before others can start.", icon: GitBranch },
] as const;

export function WorkspaceChecklist({
  workspaceName,
  snapshot,
  canManage,
  onCreateTask,
  onInviteTeam,
  onConnectWork,
  onOpenTasks,
  onOpenTeam,
  onOpenDependencies,
  onOpenRisks,
}: {
  workspaceName: string;
  snapshot: SetupSnapshot;
  canManage: boolean;
  onCreateTask: () => void;
  onInviteTeam: () => void;
  onConnectWork: () => void;
  onOpenTasks: () => void;
  onOpenTeam: () => void;
  onOpenDependencies: () => void;
  onOpenRisks: () => void;
}) {
  const progress = getSetupProgress(snapshot);
  const action: Record<SetupAction, { label: string; description: string; onClick: () => void }> = {
    "create-task": { label: canManage ? "Create your first task" : "Explore the task board", description: "Every team starts with one clear piece of work.", onClick: canManage ? onCreateTask : onOpenTasks },
    "invite-team": { label: canManage ? "Invite a teammate" : "See your team", description: "A shared plan is easier to keep up to date.", onClick: canManage ? onInviteTeam : onOpenTeam },
    "add-task": { label: canManage ? "Add another task" : "View task board", description: "Create two tasks before connecting their dependencies.", onClick: canManage ? onCreateTask : onOpenTasks },
    "connect-work": { label: canManage ? "Connect tasks" : "Explore dependencies", description: "Link work to make downstream impact visible.", onClick: canManage ? onConnectWork : onOpenDependencies },
    "explore-risks": { label: "Open Risk Center", description: "You can now explore how evidence-backed signals affect the plan.", onClick: onOpenRisks },
  };
  const next = action[progress.next];

  return (
    <section className="onboard-checklist" aria-labelledby="setup-title">
      <div className="onboard-checklist-intro">
        <span className="onboard-eyebrow"><Sparkles size={15} /> TEAM SETUP</span>
        <h2 id="setup-title">Let&apos;s get {workspaceName} ready.</h2>
        <p>Follow three small steps. Your progress is based on saved project data, not a simulated demo.</p>
        <div className="onboard-progress-label"><strong>{progress.completed} of 3 complete</strong><span>{Math.round(progress.completed / 3 * 100)}%</span></div>
        <div className="onboard-progress" role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={3} aria-valuenow={progress.completed}>
          <span style={{ width: `${progress.completed / 3 * 100}%` }} />
        </div>
        <p className="onboard-next-note">{next.description}</p>
        <button className="primary" onClick={next.onClick}>{next.label}<ArrowRight size={17}/></button>
      </div>
      <ol className="onboard-checklist-steps">
        {steps.map((step, index) => {
          const complete = progress.milestones[index].complete;
          return (
            <li key={step.id} className={complete ? "is-complete" : ""}>
              <span className="onboard-step-status" aria-label={complete ? "Completed" : `Step ${index + 1}`}>
                {complete ? <Check size={18}/> : <step.icon size={18} />}
              </span>
              <div><strong>{step.title}</strong><small>{step.description}</small></div>
              <span className="onboard-step-count">{complete ? "DONE" : `0${index + 1}`}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
