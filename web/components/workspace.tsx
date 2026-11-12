"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  TriangleAlert,
  Columns3,
  GitBranch,
  Inbox,
  Users,
  ScrollText,
  Settings,
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  Search,
  LogOut,
  Menu,
  X,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Play,
  Plus,
  ChevronRight,
  Activity,
  Check,
  FileText,
  Github,
  UserPlus,
  ChevronDown,
  LogIn,
} from "lucide-react";
import {
  api,
  ApiError,
  type Overview,
  type Person,
  type Project,
  type Graph,
  type Risk,
  type Proposal,
  type Audit,
  type Integrations,
} from "@/lib/api";
import Login from "./login";
import { IntelligenceCenter } from "./intelligence-center";
import { DashboardHero, WorkspaceLoader } from "./brand-motion";
import { DashboardAnalytics, DashboardTeam, WorkspaceSearch } from "./premium-dashboard";
import { AuditHistory } from "./audit-history";
import { EmptyWorkspaceWelcome, WorkspaceChecklist } from "./onboarding";
import { downstream } from "@/domain/graph";
import { getDeliveryFocus, getDeliveryProgress } from "@/domain/delivery-guidance";
import { dueState, sortTasksByAttention } from "@/domain/task-attention";
import { JourneySteps } from './journey-steps';
import { TaskManager } from "./task-manager";
import { WorkspaceSetup } from './workspace-management';
import { WorkspaceSettings } from './workspace-settings';
import { WorkspaceActivity } from "./workspace-activity";
import DependencyMap from "./dependency-map";
import { Brand, Badge, Busy, Empty, Modal, statusLabels } from "./ui";
import {
  TaskDialog,
  RiskDialog,
  ProposalDialog,
  DependencyDialog,
  AvailabilityForm,
} from "./workflow-dialogs";

type View =
  | "overview"
  | "intelligence"
  | "risks"
  | "tasks"
  | "dependencies"
  | "decisions"
  | "team"
  | "audit"
  | "settings";
const navigation = [
  { label: "Overview", view: "overview", icon: LayoutDashboard },
  { label: "TIC Intelligence", view: "intelligence", icon: Sparkles },
  { label: "Risk Center", view: "risks", icon: TriangleAlert },
  { label: "Task Board", view: "tasks", icon: Columns3 },
  { label: "Dependencies", view: "dependencies", icon: GitBranch },
  { label: "Decision Inbox", view: "decisions", icon: Inbox },
  { label: "Team Capacity", view: "team", icon: Users },
  { label: "Audit Log", view: "audit", icon: ScrollText },
] as const;
const titles: Record<View, [string, string]> = {
  intelligence: ["TIC Intelligence", "Understand evidence, delivery pressure and model controls."],
  overview: [
    "Delivery overview",
    "See the signals. Understand the impact. Decide with confidence.",
  ],
  risks: [
    "Risk center",
    "Evidence-backed signals, with a clear path to recovery.",
  ],
  tasks: ["Task board", "A shared plan that stays connected to your team."],
  dependencies: [
    "Dependencies",
    "Trace the connections that shape your delivery.",
  ],
  decisions: [
    "Decision inbox",
    "Review the evidence. You decide what changes.",
  ],
  team: [
    "Team capacity",
    "Plan around availability your teammates choose to share.",
  ],
  audit: ["Audit log", "A durable record of who changed what, and why."],
  settings: [
    "Project settings",
    "Connection status and workspace configuration.",
  ],
};

export default function Workspace({ initialRiskId, initialProposalId, confirmationFailed }: { initialRiskId?: string; initialProposalId?: string; confirmationFailed?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const routeView = pathname.split("/")[1];
  const view: View = routeView === "capacity" ? "team" : Object.hasOwn(titles, routeView) ? routeView as View : "overview";
  const [user, setUser] = useState<Person | null>(null),
    [projects, setProjects] = useState<Project[]>([]),
    [data, setData] = useState<Overview | null>(null),
    [graph, setGraph] = useState<Graph | null>(null),
    [risks, setRisks] = useState<Risk[]>([]),
    [proposals, setProposals] = useState<Proposal[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState(false);
  const [manageTask, setManageTask] = useState<string | null>(null);
  const [workspacePicker,setWorkspacePicker]=useState(false);
  const [settingsFocus,setSettingsFocus]=useState<"team"|"github"|null>(null);
  const [receipt,setReceipt]=useState<{title:string;decision:string;workspace:string;proposal:string}|null>(null);
  const [workspaceSetup,setWorkspaceSetup]=useState(pathname==='/join');
  const [setupMode,setSetupMode]=useState<'create'|'join'>(pathname==='/join'?'join':'create');
  const [taskId, setTaskId] = useState<string | null>(null),
    [riskId, setRiskId] = useState<string | null>(initialRiskId ?? null),
    [proposalId, setProposalId] = useState<string | null>(initialProposalId ?? null),
    [dependencyDialog, setDependencyDialog] = useState(false),
    [demo, setDemo] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [board, setBoard] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const loadSequence = useRef(0);
  const load = useCallback(async (id?: string, selected?: string) => {
    const request = ++loadSequence.current;
    try {
      const me = await api<Person>("/me");
      const list = await api<Project[]>("/projects");
      if (request !== loadSequence.current) return;
      const saved=localStorage.getItem(`teamflow.workspace.${me.id}`);
      const target = id ?? (list.some(p=>p.id===saved)?saved:undefined) ?? list[0]?.id;
      if (target) {
        const base = `/projects/${target}`;
        const [overview, g, r, p, a, i] = await Promise.all([
          api<Overview>(base + "/dashboard"),
          api<Graph>(
            base + "/dependencies" + (selected ? `?selected=${selected}` : ""),
          ),
          api<Risk[]>(base + "/risks"),
          api<Proposal[]>(base + "/proposals"),
          api<Audit[]>(base + "/audit"),
          api<Integrations>(base + "/integrations"),
        ]);
        if (request !== loadSequence.current) return;
        localStorage.setItem(`teamflow.workspace.${me.id}`,target);
        setData(overview);
        setGraph(g);
        setRisks(r);
        setProposals(p);
        setAudit(a);
        setIntegrations(i);
      } else setData(null);
      setProjects(list);
      setUser(me);
      setError("");
    } catch (e) {
      if (request !== loadSequence.current) return;
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setData(null);
      } else setError((e as Error).message);
    } finally {
      if (request === loadSequence.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    // State updates in load happen after network responses, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const activeWorkspaceId = data?.project.id;
  const selectedGraphTask = graph?.selected_task_id ?? undefined;
  const activeUserId = user?.id;
  useEffect(()=>{
    if(!activeUserId||!activeWorkspaceId||taskId||riskId||proposalId||manageTask||workspaceSetup||dependencyDialog||demo||receipt||view==='settings')return;
    let refreshing = false;
    const update=()=>{if(document.visibilityState==='visible' && !refreshing) {
      refreshing=true;
      void load(activeWorkspaceId,selectedGraphTask).finally(()=>{refreshing=false;});
    }};
    const timer=window.setInterval(update,20_000);
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[activeUserId,activeWorkspaceId,selectedGraphTask,taskId,riskId,proposalId,manageTask,workspaceSetup,dependencyDialog,demo,receipt,view,load]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement;
    const controls = () =>
      Array.from(
        navRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? [],
      ).filter((b) => b.offsetParent !== null);
    controls()[0]?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu(false);
        return;
      }
      if (e.key === "Tab") {
        const list = controls(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [menu]);
  async function refresh() {
    setBusy(true);
    await load(data?.project.id, graph?.selected_task_id ?? undefined);
  }
  function openWorkspaceSetup(mode:'create'|'join'='create') {
    setSetupMode(mode);
    setWorkspaceSetup(true);
    setWorkspacePicker(false);
    setMenu(false);
  }
  function navigate(next: View) {
    setWorkspacePicker(false);
    if(next!=="settings")setSettingsFocus(null);
    router.push(next === "team" ? "/capacity" : `/${next}`);
    setMenu(false);
    setQuery("");
    setFilter("all");
    setNotice("");
  }
  function openConnections(section:"team"|"github") {
    setSettingsFocus(section);
    navigate("settings");
  }
  function selectTask(id: string) {
    setGraph(current=>{
      if(!current)return current;
      const ids=current.nodes.map(t=>t.id);
      if(!id||!ids.includes(id))return {...current,selected_task_id:null,upstream_ids:[],downstream_ids:[]};
      const known=new Set(ids);
      const edges=current.edges.filter(e=>known.has(e.predecessor_id)&&known.has(e.successor_id));
      return {...current,selected_task_id:id,upstream_ids:downstream(ids,edges,id,true),downstream_ids:downstream(ids,edges,id)};
    });
  }
  function switchWorkspace(id:string){
    setWorkspacePicker(false);
    setTaskId(null);setRiskId(null);setProposalId(null);setManageTask(null);setDependencyDialog(false);setDemo(false);setReceipt(null);
    setBusy(true);
    navigate("overview");
    void load(id);
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      loadSequence.current++;
      setUser(null);
      setData(null);
      setMenu(false);
      router.push("/login");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (busy && !user)
    return (
      <WorkspaceLoader/>
    );
  if (!user) return <Login onLogin={() => load()} initialError={error || (confirmationFailed?"Confirmation could not be completed. If your email is already verified, sign in. Otherwise enter your email and request a fresh confirmation. Reopen your team invitation after signing in.":"")} />;
  const activeRisks = risks.filter((r) => r.active).sort((a,b)=>Number(a.stale_evidence)-Number(b.stale_evidence)||b.affected_task_ids.length-a.affected_task_ids.length||({high:3,medium:2,low:1}[b.severity]??0)-({high:3,medium:2,low:1}[a.severity]??0)),
    pending = proposals.filter((p) => p.status === "pending"),
    ready = pending.filter((p) => !p.stale);
  const lead = data?.project.role === "lead";
  const currentTask = data?.tasks.find((t) => t.id === taskId),
    currentRisk = risks.find((r) => r.id === riskId),
    currentProposal = proposals.find((p) => p.id === proposalId);
  const shownTasks = sortTasksByAttention(data?.tasks.filter(
      (t) =>
        (filter === "all" || t.status === filter) &&
        `${t.title} ${t.key}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? []);
  const shownRisks = risks.filter(
    (r) =>
      (filter === "all"
        ? r.active
        : filter === "resolved"
          ? !r.active
          : r.active && (r.severity === filter || r.evidence.kind === filter)) &&
      `${r.evidence.title} ${r.reason}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const person = (id: string | null) => data?.members.find((m) => m.id === id);
  const focus = data && graph ? getDeliveryFocus({
    role: data.project.role,
    tasks: data.tasks.length,
    connections: graph.edges.length,
    activeRisks: activeRisks.length,
    pendingDecisions: ready.length,
  }) : null;
  const progress = getDeliveryProgress({ total: data?.counts.total ?? 0, done: data?.counts.done ?? 0 });
  function openFocus() {
    if (!focus) return;
    switch (focus.kind) {
      case "decision":
        if (ready[0]) setProposalId(ready[0].id);
        break;
      case "risk":
        if (activeRisks[0]) setRiskId(activeRisks[0].id);
        break;
      case "create-task":
        setManageTask("new");
        break;
      case "connect-tasks":
        setDependencyDialog(true);
        break;
      case "view-dependencies":
        navigate("dependencies");
        break;
      default:
        navigate("tasks");
    }
  }
  return (
    <div className="shell">
      <a href="#main" className="skip">
        Skip to content
      </a>
      {menu && (
        <button
          className="scrim"
          aria-label="Close navigation overlay"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={navRef}
        className={`sidebar ${menu ? "open" : ""}`}
        role={menu ? "dialog" : undefined}
        aria-modal={menu || undefined}
        aria-label={menu ? "Navigation" : undefined}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-picker">
          <button className="workspace-switch" onClick={()=>setWorkspacePicker(v=>!v)} aria-label="Switch workspace" aria-expanded={workspacePicker} aria-controls="workspace-picker-list">
            <span className="workspace-emblem">{data?.project.name[0]??'T'}</span>
            <div><strong>{data?.project.name??'Your workspace'}</strong><small>{data?.is_demo?"Demo workspace":"Delivery workspace"}</small></div>
            <ChevronDown size={17}/>
          </button>
          {workspacePicker&&<div className="workspace-picker-list" id="workspace-picker-list" role="group" aria-label="Available workspaces">
            <span className="section-kicker">YOUR WORKSPACES</span>
            {projects.map(p=><button key={p.id} className={p.id===data?.project.id?"current-workspace":""} onClick={()=>switchWorkspace(p.id)} disabled={busy}><span className="workspace-emblem mini">{p.name[0]}</span><span><strong>{p.name}</strong><small>{p.role}</small></span>{p.id===data?.project.id&&<Check size={15}/>}</button>)}
            <div className="workspace-picker-actions"><button onClick={()=>openWorkspaceSetup("create")}><Plus size={15}/> Create workspace</button><button onClick={()=>openWorkspaceSetup("join")}><LogIn size={15}/> Join workspace</button></div>
          </div>}
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              onClick={() => navigate(item.view)}
              aria-current={view === item.view ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.view === "decisions" && ready.length > 0 && (
                <b className="nav-count">{ready.length}</b>
              )}
              {item.view === "risks" && activeRisks.length > 0 && (
                <i className="risk-dot" />
              )}
            </button>
          ))}
        </nav>
        <span className="nav-label">CONNECT</span>
        <nav aria-label="Workspace connections" className="connection-nav">
          <button className={`nav-item ${view==="settings"&&settingsFocus==="team"?"active":""}`} onClick={()=>openConnections("team")}><UserPlus size={19}/><span>Team & invitations</span></button>
          <button className={`nav-item ${view==="settings"&&settingsFocus==="github"?"active":""}`} onClick={()=>openConnections("github")}><Github size={19}/><span>GitHub connection</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={21} />
            <strong>Human-led. Evidence-backed.</strong>
            <p>Your team stays in control of every plan change.</p>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => {setSettingsFocus(null);navigate("settings");}}
          >
            <Settings size={19} />
            Settings
          </button>
          <div className="profile">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{data?.project.role ?? "Member"}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-toggle icon-button"
            aria-label="Open navigation"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <label htmlFor="project" className="sr-only">
              Project
            </label>
            <select
              id="project"
              value={data?.project.id ?? ""}
              onChange={(e) => {
                switchWorkspace(e.target.value);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {data&&<WorkspaceSearch key={data.project.id} data={data} risks={risks} onTask={setTaskId} onRisk={setRiskId} onPerson={()=>navigate("team")} onDependency={id=>{selectTask(id);navigate("dependencies");}}/>}
          <div className="topbar-right">
            <span className="environment">
              <i />
              {data?.is_demo ? "Labeled demo" : "Saved workspace"}
            </span>
            {data && data.members.length > 0 && <button type="button" className="avatar-stack team-avatar-action" aria-label={`View team capacity (${data.members.length} members)`} onClick={()=>navigate("team")}>
              {data?.members.slice(0, 3).map((m, i) => (
                <span
                  key={m.id}
                  className={`avatar small color-${i}`}
                  title={m.name}
                >
                  {m.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join("")}
                </span>
              ))}
              {data.members.length > 3 && <span className="team-count">+{data.members.length - 3}</span>}
            <span className="team-avatar-label">{data.members.length} {data.members.length===1?"member":"members"}</span>
            </button>}
          </div>
        </header>
        <main id="main" tabIndex={-1} aria-busy={busy}>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {notice && (
            <div className="success-banner" role="status">
              <Check size={16} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {!data || !graph || !integrations ? (
            projects.length ? (
              <section className="panel settings-panel" aria-label="Workspace unavailable">
                <h1>We couldn&apos;t open this workspace.</h1>
                <p>Your projects are still listed. Retry loading the selected workspace; no changes have been made.</p>
                <button className="primary" disabled={busy} onClick={refresh}>Retry workspace</button>
              </section>
            ) : (
              <EmptyWorkspaceWelcome onCreate={()=>openWorkspaceSetup('create')} onJoin={()=>openWorkspaceSetup('join')} />
            )
          ) : (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    {data.project.name.toUpperCase()}
                    {data.is_demo&&<span className="demo-badge">DEMO WORKSPACE</span>}
                  </div>
                  <h1>{titles[view][0]}</h1>
                  <p>{titles[view][1]}</p>
                </div>
                <div className="heading-actions">
                  <WorkspaceActivity key={data.project.id} entries={audit} onViewAll={()=>navigate("audit")}/>
                  <button
                    className={`icon-button refresh-button ${busy ? "spin" : ""}`}
                    aria-label="Refresh data"
                    title="Refresh data"
                    disabled={busy}
                    onClick={refresh}
                  >
                    <RefreshCw size={18} />
                  </button>
                  {lead && data.is_demo && (
                    <button className="secondary" onClick={() => setDemo(true)}>
                      <Play size={15} />
                      Replay demo event
                    </button>
                  )}
                </div>
              </div>
              <div className="context-line">
                <span>
                  <i className="live-dot" />
                  Stored in PostgreSQL
                </span>
                <span>Plan v{data.plan_version}</span>
                {data.fixture_label&&<span>{data.fixture_label}</span>}
              </div>
              <div className="view-content" key={view}>
                {receipt&&receipt.workspace===data.project.id&&<section className="panel recovery-receipt" aria-label="Recovery decision recorded">
                  <JourneySteps current={3}/><h2>{receipt.decision==='approve'?'Approved plan saved':'Proposal rejected — plan unchanged'}</h2><p>{receipt.title}</p><p>The decision is recorded in your workspace history. {receipt.decision==='approve'?'Check the updated task assignments and follow up on the source signal.':'No proposed changes were applied.'}</p>
                  <div className="dialog-actions"><button className="primary" onClick={()=>{setReceipt(null);navigate('tasks');}}>View current plan</button><button className="secondary" onClick={()=>{setReceipt(null);navigate('audit');}}>View decision history</button><button className="text-link" onClick={()=>setReceipt(null)}>Dismiss receipt</button></div>
                </section>}
                {view === "intelligence" && <IntelligenceCenter key={data.project.id} workspace={data.project.id} onRisk={id=>setRiskId(id)}/>}
                {view === "overview" && (
                  <>
                    <DashboardHero demoAction={data.is_demo&&lead?"Replay demo scenario":projects.some(p=>p.is_demo&&p.id!==data.project.id)?"Open demo workspace":"Explore dependencies"} onDemo={()=>{if(data.is_demo&&lead){setDemo(true);return;}const sample=projects.find(p=>p.is_demo&&p.id!==data.project.id);if(sample)switchWorkspace(sample.id);else navigate("dependencies");}} onGithub={()=>openConnections("github")} githubLinked={Boolean(integrations.github_repository)}/>
                    <section className="stats premium-stats" aria-label="Delivery statistics">
                      {[
                        {label:"Delivery risks",value:activeRisks.length,icon:TriangleAlert,note:activeRisks.length?"Active evidence signals":"No active risk signals",color:"red",target:"risks"},
                        {label:"Approval queue",value:pending.length,icon:Inbox,note:`${ready.length} ready for review`,color:"amber",target:"decisions"},
                        {label:"Active tasks",value:data.tasks.filter(t=>t.status!=="done").length,icon:CheckCheck,note:`${data.counts.blocked} blocked · ${data.counts.in_progress} in progress`,color:"teal",target:"tasks"},
                        {label:"Team capacity",value:`${data.members.reduce((sum,m)=>sum+m.available_hours,0)}h`,icon:Users,note:`${data.members.length} teammates · shared hours`,color:"blue",target:"team"},
                      ].map(metric=><button key={metric.label} className={`stat ${metric.color}`} onClick={()=>navigate(metric.target as View)}><div><span>{metric.label}</span><metric.icon size={19}/></div><strong>{metric.value}</strong><small>{metric.note}<ArrowUpRight size={14}/></small><span className="metric-signal" aria-hidden="true"/></button>)}
                    </section>
                    <section className="connection-launchpad" aria-label="Workspace connection shortcuts">
                      <button onClick={()=>openConnections("team")}><span className="connection-icon"><Users size={23}/></span><span><strong>Connect your team</strong><small>{data.members.length} {data.members.length===1?"member":"members"} · Invite by email</small></span><ArrowUpRight size={18}/></button>
                      <button onClick={()=>openConnections("github")}><span className="connection-icon"><Github size={23}/></span><span><strong>{integrations.github_repository?"GitHub repository":"Connect GitHub project"}</strong><small>{integrations.github_repository??"Link your code and see CI activity"}</small></span><ArrowUpRight size={18}/></button>
                      {data.is_demo&&<button onClick={()=>setDemo(true)} disabled={!lead}><span className="connection-icon"><Play size={23}/></span><span><strong>Guided demo</strong><small>{lead?"Replay a sample with your team":"Ask a workspace lead to replay"}</small></span><ArrowUpRight size={18}/></button>}
                    </section>
                    <div className="premium-overview-grid">
                      <DependencyMap key={data.project.id} graph={graph} risks={risks} members={data.members} onSelect={selectTask} onOpen={()=>navigate("dependencies")}/>
                      <section className="panel premium-risk-insights" aria-label="Risk insights">
                        <div className="panel-head"><div><span className="section-kicker">DELIVERY INTELLIGENCE</span><h2>Risk insights</h2></div><button className="text-link" onClick={()=>navigate("risks")}>View all <ArrowRight size={15}/></button></div>
                        {activeRisks.length?<div className="premium-risk-list">{activeRisks.slice(0,3).map(r=><RiskRow key={r.id} risk={r} onClick={()=>setRiskId(r.id)}/>)}</div>:<div className="premium-clear"><ShieldCheck size={28}/><strong>No active risk signals</strong><p>New evidence will appear here when a risk rule is met.</p></div>}
                        <div className="premium-recommendation"><Sparkles size={21}/><div><strong>Recommended next step</strong><p>{focus?.description}</p><button className="secondary" onClick={openFocus}>{focus?.action} <ArrowRight size={15}/></button></div></div>
                        <p className="premium-approval-note"><ShieldCheck size={15}/> Human approval required for plan changes.</p>
                      </section>
                      <DashboardTeam data={data} onManage={()=>navigate("team")} onInvite={()=>openConnections("team")}/>
                    </div>
                    <div className="premium-analytics-grid">
                    <section className="delivery-progress-panel" aria-label="Task completion progress">
                      <div>
                        <span className="section-kicker">LIVE PLAN PROGRESS</span>
                        <h2>{progress.caption}</h2>
                        <p>Based on saved task statuses. This is not a release-success forecast.</p>
                      </div>
                      <div className="delivery-progress-visual">
                        <strong>{progress.percentage}%</strong>
                        <div className="delivery-progress-track" role="progressbar" aria-label="Completed tasks" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}>
                          <span style={{width: `${progress.percentage}%`}}/>
                        </div>
                        {data.counts.total > 0 && (
                          <div className="status-mix">
                            <div className="status-mix-track" role="img" aria-label={Object.entries(statusLabels).map(([status, label]) => `${label}: ${data.counts[status] ?? 0}`).join(", ")}>
                              {Object.keys(statusLabels).map((status) => (
                                <span
                                  key={status}
                                  className={status}
                                  style={{ width: `${Math.max(0, data.counts[status] ?? 0) / data.counts.total * 100}%` }}
                                />
                              ))}
                            </div>
                            <ul className="status-mix-legend" aria-label="Task breakdown">
                              {Object.entries(statusLabels).map(([status, label]) => (
                                <li key={status}><span className={`dot ${status}`} aria-hidden="true" />{label} · {data.counts[status] ?? 0}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </section>

                      <DashboardAnalytics data={data} risks={activeRisks}/>
                    </div>
                    {!data.is_demo && !activeRisks.length && (data.tasks.length < 2 || data.members.length < 2 || graph.edges.length === 0) && (
                      <WorkspaceChecklist
                        workspaceName={data.project.name}
                        snapshot={{ tasks: data.tasks.length, members: data.members.length, connections: graph.edges.length }}
                        canManage={lead}
                        onCreateTask={()=>setManageTask('new')}
                        onInviteTeam={()=>openConnections('team')}
                        onConnectWork={()=>setDependencyDialog(true)}
                        onOpenTasks={()=>navigate('tasks')}
                        onOpenTeam={()=>navigate('team')}
                        onOpenDependencies={()=>navigate('dependencies')}
                        onOpenRisks={()=>navigate('risks')}
                      />
                    )}
                    <section className="recovery-focus" aria-label="Your next action">
                      <div className="recovery-focus-copy">
                        <span className="section-kicker">{focus?.eyebrow}</span>
                        <h2>{focus?.heading}</h2>
                        <p>{focus?.description}</p>
                        <div className="dialog-actions">
                          <button className="primary" onClick={openFocus}>{focus?.action}<ArrowRight size={17}/></button>
                          {ready.length > 0 && <button className="secondary" onClick={() => navigate("decisions")}>Open decision inbox</button>}
                          {lead && data.is_demo && <button className="text-link" onClick={() => setDemo(true)}>Try a labeled demo scenario</button>}
                        </div>
                      </div>
                      <div className="journey-explainer">
                        <JourneySteps current={focus?.kind === "decision" ? 2 : 0}/>
                        <p>Evidence starts the conversation. Your team reviews the impact. <strong>Only people approve changes.</strong></p>
                      </div>
                    </section>

                    <div className="lower-grid">
                      <section className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>Risk feed</h2>
                            <p>The latest signals behind your delivery.</p>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => navigate("risks")}
                          >
                            View all
                            <ArrowRight size={15} />
                          </button>
                        </div>
                        {activeRisks.length ? (
                          <div className="risk-feed">
                            {activeRisks.slice(0, 3).map((r) => (
                              <RiskRow
                                key={r.id}
                                risk={r}
                                onClick={() => setRiskId(r.id)}
                              />
                            ))}
                          </div>
                        ) : (
                          <Empty
                            title="No active risks"
                            description="Signals appear here when observed evidence meets a risk rule."
                          />
                        )}
                      </section>
                      <section className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>Decision queue</h2>
                            <p>Changes waiting for a human decision.</p>
                          </div>
                          <Inbox size={20} />
                        </div>
                        {pending.length ? (
                          <div className="decision-list">
                            {[...ready,...pending.filter(p=>p.stale)].slice(0, 3).map((p) => (
                              <button
                                key={p.id}
                                onClick={() => setProposalId(p.id)}
                              >
                                <span className="decision-icon">
                                  <GitBranch size={19} />
                                </span>
                                <div>
                                  <strong>{p.title}</strong>
                                  <small>
                                    {p.stale
                                      ? "Plan changed · needs regeneration"
                                      : `${p.actions.length} proposed changes · ${p.source === "rules" ? "rule-based" : p.source}`}
                                  </small>
                                </div>
                                <ChevronRight size={17} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Empty
                            title="Nothing waiting on you"
                            description="Recovery proposals and team plan changes appear here."
                          />
                        )}
                      </section>
                    </div>
                  </>
                )}
                {view === "risks" && (
                  <>
                  <section className="risk-command" aria-label="Risk protection overview">
                    <div className="risk-command-intro"><span className="section-kicker">DELIVERY INTELLIGENCE</span><h2>See the impact. Protect the plan.</h2><p>Verified signals, mapped work and human-reviewed recovery.</p></div>
                    <div className="risk-command-metrics">
                      <div><TriangleAlert size={19}/><strong>{activeRisks.length}</strong><span>Active risks</span></div>
                      <div><GitBranch size={19}/><strong>{new Set(activeRisks.flatMap(r=>r.affected_task_ids)).size}</strong><span>Affected tasks</span></div>
                      <div><ShieldCheck size={19}/><strong>{activeRisks.filter(r=>r.evidence.origin==="github").length}</strong><span>GitHub signals</span></div>
                    </div>
                    <p className="risk-command-note">A passing CI run resolves its matching CI signal, not every project risk. Plan changes require approval.</p>
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>
                          Delivery signals{" "}
                          <span className="count">
                            {activeRisks.length} active
                          </span>
                        </h2>
                        <p>Deterministic rules. Inspectable source records.</p>
                      </div>
                    </div>
                    <div className="filters">
                      <SearchInput
                        value={query}
                        onChange={setQuery}
                        label="Search risks"
                      />
                      <select
                        aria-label="Risk filter"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">Active risks</option>
                        <option value="high">High severity</option>
                        <option value="medium">Medium severity</option>
                        <option value="resolved">Resolved risks</option>
                        <option value="ci_failure">CI failures</option>
                        <option value="dependency">Dependency cascades</option>
                        <option value="review_delay">PR review delays</option>
                        <option value="capacity">Voluntary capacity</option>
                      </select>
                    </div>
                    <div className="risk-feed">
                      {shownRisks.map((r) => (
                        <RiskRow
                          key={r.id}
                          risk={r}
                          onClick={() => setRiskId(r.id)}
                        />
                      ))}
                    </div>
                    {!shownRisks.length && (
                      <Empty
                        title={activeRisks.length || query || filter !== 'all' ? "No matching risk signals" : "No active risk signals"}
                        description={activeRisks.length || query || filter !== 'all' ? "Try a different search or risk filter." : "A risk appears only when observed evidence meets a documented rule."}
                      >
                        {(query || filter !== 'all') && <button className="secondary" onClick={()=>{setQuery('');setFilter('all');}}>Clear risk filters</button>}
                      </Empty>
                    )}
                  </section>
                  </>
                )}
                {view === "tasks" && (
                  <>
                    <div className="task-intro">
                      <div><span className="section-kicker">YOUR TEAM&apos;S PLAN</span><h2>{data.tasks.length} saved {data.tasks.length === 1 ? "task" : "tasks"}</h2><p>Open a card to update status or propose a change. Work requiring attention appears first in each column.</p></div>
                      {lead && integrations.ai_provider === "gemini" && <button className="primary" onClick={() => setManageTask("new")}><Plus size={17}/> Create task</button>}
                    </div>
                    <div className="task-toolbar">
                      <SearchInput
                        value={query}
                        onChange={setQuery}
                        label="Search tasks"
                      />
                      <select
                        aria-label="Task status"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {Object.entries(statusLabels).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <div className="segmented">
                        <button
                          aria-pressed={board}
                          onClick={() => setBoard(true)}
                        >
                          Board
                        </button>
                        <button
                          aria-pressed={!board}
                          onClick={() => setBoard(false)}
                        >
                          List
                        </button>
                      </div>
                      {(query || filter !== "all") && (
                        <button
                          className="text-link"
                          onClick={() => {
                            setQuery("");
                            setFilter("all");
                          }}
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                    {board && <p className="mobile-board-hint">Swipe left or right to see all four columns. Switch to List for a compact task view.</p>}
                    {board ? (
                      <div className="kanban">
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <section className="kanban-column" key={status}>
                            <h2>
                              <span className={`column-dot ${status}`} />
                              {label}
                              <small>
                                {
                                  shownTasks.filter((t) => t.status === status)
                                    .length
                                }
                              </small>
                            </h2>
                            {shownTasks
                              .filter((t) => t.status === status)
                              .map((t) => (
                                <button
                                  className="task-card"
                                  key={t.id}
                                  onClick={() => setTaskId(t.id)}
                                >
                                  <div>
                                    <span className="mono">{t.key}</span>
                                    {t.priority !== "normal" && (
                                      <Badge value={t.priority} />
                                    )}
                                  </div>
                                  <h3>{t.title}</h3>
                                  <p>{t.description}</p>
                                  <footer>
                                    <span className="avatar small">
                                      {person(t.owner_id)?.name[0] ?? "?"}
                                    </span>
                                    <span>{person(t.owner_id)?.name ?? "Unassigned"}</span>
                                    <span>{t.estimate_hours}h</span>
                                  </footer>
                                  {t.due_at && <div className={`task-due ${dueState(t.due_at, t.status)}`}>
                                    {dueState(t.due_at, t.status) === "overdue" ? "Overdue · " : "Due · "}
                                    <time dateTime={t.due_at}>{new Date(t.due_at).toLocaleDateString(undefined, {month:"short",day:"numeric",year:"numeric"})}</time>
                                  </div>}
                                </button>
                              ))}
                            {!shownTasks.some((t) => t.status === status) && (
                              <div className="column-empty">No tasks</div>
                            )}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <section className="panel task-list">
                        {shownTasks.map((t) => (
                          <button key={t.id} onClick={() => setTaskId(t.id)}>
                            <span className="mono">{t.key}</span>
                            <strong>{t.title}</strong>
                            <span className="owner-name">
                              {person(t.owner_id)?.name}
                            </span>
                            <Badge value={t.status} />
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </section>
                    )}
                    {!shownTasks.length && (
                      <Empty
                        title={data.tasks.length ? "No tasks match these filters" : "Your task board is empty"}
                        description={data.tasks.length ? "Clear the search or status filter to see all saved work." : "Create a task with an owner to begin tracking real delivery work."}
                      >
                        {data.tasks.length ? <button className="secondary" onClick={() => {setQuery("");setFilter("all");}}>Clear filters</button>
                          : lead && integrations.ai_provider === "gemini" ? <button className="primary" onClick={() => setManageTask("new")}><Plus size={17}/> Create first task</button> : null}
                      </Empty>
                    )}
                  </>
                )}
                {view === "dependencies" && (
                  <>
                    <div className="section-actions">
                      <div className="human-note">
                        <GitBranch size={18} />
                        Select a task to highlight reachable successors.
                        Connections are validated before approval.
                      </div>
                      <button
                        className="secondary"
                        disabled={data.project.role === "viewer" || data.tasks.length < 2}
                        onClick={() => setDependencyDialog(true)}
                      >
                        <Plus size={16} />
                        Propose dependency
                      </button>
                    </div>
                    {data.tasks.length < 2 && <p className="field-help">Add at least two tasks before proposing a dependency.</p>}
                    <DependencyMap key={data.project.id} graph={graph} risks={risks} onSelect={selectTask} members={data.members} onOpenTask={setTaskId} expanded/>
                  </>
                )}
                {view === "decisions" && (
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Recovery proposals</h2>
                        <p>
                          Only validated, current proposals can be approved by a
                          lead.
                        </p>
                      </div>
                    </div>
                    <div className="filters">
                      <select
                        aria-label="Proposal status"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All proposals</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="proposal-list">
                      {proposals
                        .filter((p) => filter === "all" || p.status === filter)
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setProposalId(p.id)}
                          >
                            <span className="decision-icon">
                              <GitBranch size={21} />
                            </span>
                            <div>
                              <strong>{p.title}</strong>
                              <p>
                                {p.actions.length} changes ·{" "}
                                {p.source === "rules"
                                  ? "Rule-based suggestion"
                                  : ["openai", "gemini"].includes(p.source)
                                    ? `${p.source === "gemini" ? "Gemini" : "OpenAI"} analysis`
                                    : "Team proposal"}{" "}
                                · Plan v{p.base_plan_version}
                              </p>
                            </div>
                            <Badge value={p.stale ? "stale" : p.status} />
                            <ArrowUpRight size={18} />
                          </button>
                        ))}
                    </div>
                    {!proposals.filter(
                      (p) => filter === "all" || p.status === filter,
                    ).length && (
                      <Empty
                        title={proposals.length ? "No proposals with this status" : "No proposals yet"}
                        description={proposals.length ? "Switch the status filter to view other decisions." : "Open a risk to explore recovery options, or propose a protected change from a task."}
                      >
                        {proposals.length > 0 ? <button className="secondary" onClick={()=>setFilter('all')}>Show all proposals</button> : <button className="secondary" onClick={()=>navigate('risks')}>Open Risk Center</button>}
                      </Empty>
                    )}
                  </section>
                )}
                {view === "team" && (
                  <>
                    <section className="team-connect-strip panel"><div className="team-connect-copy"><span className="section-kicker">SHARED WORKSPACE</span><h2>Bring your team together</h2><p>Invite teammates, manage access and review their shared capacity.</p></div><button className="primary" onClick={()=>openConnections("team")}><UserPlus size={17}/> Team & invitations</button></section>
                    {data.project.role !== "viewer" && data.members.find((m) => m.id === user.id) && (
                      <AvailabilityForm
                        dated={true}
                        key={data.as_of}
                        member={data.members.find((m) => m.id === user.id)!}
                        projectId={data.project.id}
                        onSaved={async () => {
                          await refresh();
                          setNotice("Your availability was saved.");
                        }}
                      />
                    )}
                    <div className="members-grid">
                      {data.members.map((m, i) => (
                        <section className="panel member-card" key={m.id}>
                          <div className="member-top">
                            <span className={`avatar large color-${i}`}>
                              {m.name[0]}
                            </span>
                            <Badge value={m.role} />
                          </div>
                          <h2>{m.name}</h2>
                          <p>{m.specialty}</p>
                          <small>{m.email}</small>
                          <div className="capacity-meter">
                            <span
                              style={{
                                width: `${Math.min((m.available_hours / 40) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <div className="member-footer">
                            <span>{m.available_hours}h available</span>
                            <span>
                              {
                                data.tasks.filter(
                                  (t) =>
                                    t.owner_id === m.id && t.status !== "done",
                                ).length
                              }{" "}
                              active tasks
                            </span>
                          </div>
                        </section>
                      ))}
                    </div>
                    <div className="privacy-note">
                      <ShieldCheck size={18} />
                      <p>
                        Availability is explicitly shared by each member.
                        TeamFlow Guard does not monitor private messages or
                        infer productivity.
                      </p>
                    </div>
                  </>
                )}
                {view === "audit" && integrations.ai_provider === 'gemini' && <AuditHistory key={data.project.id} workspace={data.project.id}/>}
                {view === "audit" && integrations.ai_provider !== 'gemini' && (
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Activity & decisions</h2>
                        <p>
                          Append-only records, newest first. Showing up to 100
                          events.
                        </p>
                      </div>
                      <ScrollText size={20} />
                    </div>
                    <div className="audit-list">
                      {audit.map((a) => (
                        <details key={a.id}>
                          <summary>
                            <span className="audit-icon">
                              {a.kind.includes("approved") ? (
                                <Check size={17} />
                              ) : (
                                <Activity size={17} />
                              )}
                            </span>
                            <div>
                              <strong>{a.summary}</strong>
                              <small>
                                {a.actor_name} ·{" "}
                                {new Date(a.created_at).toLocaleString()}
                              </small>
                            </div>
                            <span className="version-label">
                              v{a.plan_version}
                            </span>
                            <ChevronRight size={16} />
                          </summary>
                          <div className="audit-detail">
                            <span className="mono">Event {a.id}</span>
                            <pre>{JSON.stringify(a.changes, null, 2)}</pre>
                          </div>
                        </details>
                      ))}
                    </div>
                    {!audit.length && (
                      <Empty
                        title="A fresh start"
                        description="Status updates, replayed events and decisions will be recorded here."
                      />
                    )}
                  </section>
                )}
                {view === "settings" && (
                  <div className="settings-grid">
                    {integrations.ai_provider === 'gemini' ? (
                      <WorkspaceSettings key={data.project.id} id={data.project.id} onSaved={refresh} focus={settingsFocus}/>
                    ) : (
                      <section className="panel settings-panel">
                        <span className="section-kicker">LOCAL PROJECT</span>
                        <h2>Workspace details</h2>
                        <p>This legacy local project uses its original configuration. Team roles, invitations and tracked-branch rules can be managed in a TeamFlow Guard online workspace.</p>
                      </section>
                    )}
                    <section className="panel settings-panel">
                      <span className="section-kicker">CONNECTIONS</span>
                      <h2>Intelligence & evidence</h2>
                      <div className="integration-row">
                        <Sparkles size={23} />
                        <div>
                          <strong>{integrations?.ai_provider === "gemini" ? "Gemini API" : "OpenAI API"}</strong>
                          <p>
                            {integrations.ai_configured
                              ? integrations.ai_model
                              : "Add a server API key and model to enable analysis."}
                          </p>
                        </div>
                        <Badge
                          value={
                            integrations.ai_configured
                              ? "configured"
                              : "not configured"
                          }
                        />
                      </div>
                      <div className="integration-row">
                        <GitBranch size={23} />
                        <div>
                          <strong>GitHub</strong>
                          <p>
                            {integrations.github_repository
                              ? `${integrations.github_app_bound ? "GitHub App repository" : "Public repository"} ${integrations.github_repository} linked read-only. Recent activity appears above; risk evidence import remains manual.`
                              : integrations.github_evidence_imported
                                ? "Historical workflow evidence was imported manually. No live repository linked."
                                : "No public repository linked. Demo events are labeled."}
                          </p>
                        </div>
                        <Badge
                          value={
                            integrations.github_repository
                              ? "read-only link"
                              : integrations.github_evidence_imported ? "manual evidence" : "not connected"
                          }
                        />
                      </div>
                      <div className="human-note">
                        <ShieldCheck size={18} />
                        <span>
                          API keys stay on the server. Analysis never applies
                          plan changes.
                        </span>
                      </div>
                    </section>
                    <section className="panel settings-panel">
                      <span className="section-kicker">PROJECT</span>
                      <h2>{data.project.name}</h2>
                      <dl>
                        <dt>Environment</dt>
                        <dd>{data.is_demo?'Isolated demo':'Team workspace'}</dd>
                        <dt>Your role</dt>
                        <dd>{data.project.role}</dd>
                        <dt>Plan version</dt>
                        <dd>{data.plan_version}</dd>
                        <dt>Members</dt>
                        <dd>{data.members.length}</dd>
                      </dl>
                      <p className="field-help">
                        Changes are saved to your workspace and recorded in the audit log.
                      </p>
                    </section>
                  </div>
                )}
              </div>
              <footer className="page-footer">
                <ShieldCheck size={14} />
                <span>Evidence informs. Your team decides.</span>
                <span>
                  Updated{" "}
                  {new Date(data.as_of).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {currentTask && data && (
        <TaskDialog
          task={currentTask}
          onManage={lead && integrations?.ai_provider === "gemini" ? () => {setTaskId(null);setManageTask(currentTask.id);} : undefined}
          data={data}
          userId={user.id}
          onClose={() => setTaskId(null)}
          onSaved={async () => {
            await refresh();
            setNotice(
              "Task update saved. Protected changes are waiting in Decision Inbox.",
            );
          }}
        />
      )}
      {workspaceSetup&&<WorkspaceSetup displayName={user.name} initialMode={setupMode} onClose={()=>setWorkspaceSetup(false)} onSaved={async id=>{await load(id);router.push('/overview');}}/>}
      {manageTask && data && <TaskManager data={data} task={data.tasks.find(t => t.id === manageTask)} onClose={() => setManageTask(null)} onSaved={async action=>{await refresh();setNotice(action==='created'?'Task created and saved to your workspace.':action==='archived'?'Task archived. Your audit history is preserved.':'Task details saved.');}} />}
      {currentRisk && data && integrations && (
        <RiskDialog
          key={currentRisk.id}
          risk={currentRisk}
          tasks={data.tasks}
          integrations={integrations}
          readOnly={data.project.role === "viewer"}
          onClose={() => setRiskId(null)}
          onProposal={async (p) => {
            await refresh();
            setRiskId(null);
            setProposalId(p.id);
          }}
        />
      )}
      {currentProposal && data && (
        <ProposalDialog
          proposal={currentProposal}
          data={data}
          sourceRisk={risks.find(r=>r.id===currentProposal.risk_id)}
          onClose={() => setProposalId(null)}
          onDecided={async (decision) => {
            await refresh();
            setReceipt({title:currentProposal.title,decision,workspace:data.project.id,proposal:currentProposal.id});
            setNotice(
              "Decision recorded. The current plan and audit log are up to date.",
            );
          }}
        />
      )}
      {dependencyDialog && data && graph && (
        <DependencyDialog
          data={data}
          graph={graph}
          onClose={() => setDependencyDialog(false)}
          onSaved={async () => {
            await refresh();
            setNotice(
              "Dependency validated. Review the proposal in Decision Inbox.",
            );
          }}
        />
      )}
      {demo && data && (
        <DemoDialog
          data={data}
          graph={graph}
          onClose={() => setDemo(false)}
          onReplay={async (kind, task) => {
            const updatedRisks=await api<Risk[]>(`/projects/${data.project.id}/demo-events`, {
              method: "POST",
              body: JSON.stringify({
                kind,
                task_id: task,
                event_key: crypto.randomUUID(),
              }),
            });
            await refresh();
            setDemo(false);
            const signal=updatedRisks.find(r=>r.active&&r.evidence.kind===kind&&r.evidence.task_id===task);
            if(signal)setRiskId(signal.id);else navigate('risks');
            setNotice(
              "Sample event replayed and labeled. Inspect the source in Risk Center.",
            );
          }}
        />
      )}
    </div>
  );
}
function SearchInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="search">
      <Search size={18} />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label + "…"}
      />
    </label>
  );
}
function RiskRow({ risk, onClick }: { risk: Risk; onClick: () => void }) {
  return (
    <button className="risk-row" onClick={onClick}>
      <span className={`risk-icon ${risk.severity}`}>
        <TriangleAlert size={21} />
      </span>
      <div>
        <strong>{risk.evidence.title}</strong>
        <p>
          {risk.affected_task_ids.length} downstream tasks ·{" "}
          {risk.evidence.origin === "replay"
            ? "Replayed sample"
            : risk.evidence.origin}{" "}
          ·{" "}
          {new Date(risk.evidence.observed_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {risk.stale_evidence ? " · Evidence needs refresh" : ""}
        </p>
      </div>
      <Badge value={risk.active ? risk.severity : "resolved"} />
      <ChevronRight size={16} />
    </button>
  );
}
function DemoDialog({data,graph,onClose,onReplay}: {data:Overview;graph:Graph|null;onClose:()=>void;onReplay:(kind:string,task:string)=>Promise<void>}) {
  const eligible=data.tasks.filter(t=>t.status!=="done");
  const [kind,setKind]=useState("ci_failure"),[owner,setOwner]=useState("all"),[task,setTask]=useState(eligible.find(t=>t.key==="AUTH-142")?.id??eligible[0]?.id??""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const scenarios=[
    {id:"ci_failure",title:"CI check fails",description:"A failed build threatens dependent work."},
    {id:"review_delay",title:"PR review delayed",description:"A review waits 48 hours."},
    {id:"dependency",title:"Upstream work blocked",description:"Trace the downstream tasks that depend on a blocked item."},
    {id:"capacity",title:"Capacity disruption",description:"A teammate shares reduced availability for two days."},
    {id:"ci_pass",title:"CI check passes again",description:"Resolve the matching CI signal."},
  ];
  const tasks=eligible.filter(t=>owner==="all"||t.owner_id===owner);
  const selected=eligible.find(t=>t.id===task),person=data.members.find(m=>m.id===selected?.owner_id);
  const ids=graph?.nodes.map(t=>t.id)??[],known=new Set(ids);
  const affected=selected&&known.has(selected.id)?downstream(ids,(graph?.edges??[]).filter(e=>known.has(e.predecessor_id)&&known.has(e.successor_id)),selected.id):[];
  const people=[...new Set(affected.map(id=>data.tasks.find(t=>t.id===id)?.owner_id).filter(Boolean))].map(id=>data.members.find(m=>m.id===id)).filter(Boolean);
  async function run(){if(!selected||busy)return;setBusy(true);setError("");try{await onReplay(kind,task);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title="Replay a demo event" onClose={onClose} wide>
    <div className="demo-disclosure"><Play size={20}/><p><strong>Guided rehearsal · fictional evidence</strong><br/>Choose a scenario and the work it affects. Replays never pretend to be live GitHub activity or change the approved plan.</p></div>
    <div className="demo-journey" aria-label="Demo walkthrough"><span><b>1</b> Replay signal</span><span><b>2</b> Inspect impact</span><span><b>3</b> Review a recovery</span><span><b>4</b> Decide &amp; audit</span></div>
    <div className="demo-step-label">01 · Choose a scenario</div>
    <div className="demo-scenario-grid" role="group" aria-label="Demo scenarios">{scenarios.map(s=><button key={s.id} type="button" className={kind===s.id?"chosen":""} aria-pressed={kind===s.id} disabled={busy} onClick={()=>setKind(s.id)}><strong>{s.title}</strong><small>{s.description}</small></button>)}</div>
    <div className="demo-step-label">02 · Choose a teammate and task</div>
    <div className="form-grid"><label>Teammate<select value={owner} disabled={busy} onChange={e=>{const next=e.target.value;setOwner(next);setTask(eligible.find(t=>next==="all"||t.owner_id===next)?.id??"");}}><option value="all">All teammates</option>{data.members.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
    <label>Linked task<select value={task} disabled={busy||!tasks.length} onChange={e=>setTask(e.target.value)}><option value="" disabled>Choose a task</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.key} · {t.title}</option>)}</select></label></div>
    {!tasks.length&&<p className="field-help">No unfinished tasks assigned to this teammate. Choose another teammate or assign work in Task Board.</p>}
    <div className="demo-impact-preview"><div><span className="section-kicker">03 · EXPECTED IMPACT</span><h3>{selected?selected.key+" · "+selected.title:"Select a task to preview"}</h3><p>{person?"Assigned to "+person.name:"No assigned teammate"} · {affected.length} downstream tasks</p></div>
    {people.length>0&&<div className="demo-people">{people.map(p=>p&&<span key={p.id}><span className="avatar small">{p.name[0]}</span>{p.name}</span>)}</div>}
    {affected.length>0&&<p className="field-help">Affected work: {affected.map(id=>data.tasks.find(t=>t.id===id)?.key).filter(Boolean).join(" → ")}</p>}
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="dialog-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!selected} onClick={run}>{busy?<Busy text="Recording sample event…"/>:<><Play size={16}/> Replay event</>}</button></div>
  </Modal>;
}
