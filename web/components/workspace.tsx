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
import { AuditHistory } from "./audit-history";
import { TaskManager } from "./task-manager";
import { WorkspaceSetup, WorkspaceSettings } from './workspace-management';
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
  | "risks"
  | "tasks"
  | "dependencies"
  | "decisions"
  | "team"
  | "audit"
  | "settings";
const navigation = [
  { label: "Overview", view: "overview", icon: LayoutDashboard },
  { label: "Risk Center", view: "risks", icon: TriangleAlert },
  { label: "Task Board", view: "tasks", icon: Columns3 },
  { label: "Dependencies", view: "dependencies", icon: GitBranch },
  { label: "Decision Inbox", view: "decisions", icon: Inbox },
  { label: "Team Capacity", view: "team", icon: Users },
  { label: "Audit Log", view: "audit", icon: ScrollText },
] as const;
const titles: Record<View, [string, string]> = {
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

export default function Workspace({ initialRiskId, initialProposalId }: { initialRiskId?: string; initialProposalId?: string } = {}) {
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
  const [workspaceSetup,setWorkspaceSetup]=useState(pathname==='/join');
  const [taskId, setTaskId] = useState<string | null>(null),
    [riskId, setRiskId] = useState<string | null>(initialRiskId ?? null),
    [proposalId, setProposalId] = useState<string | null>(initialProposalId ?? null),
    [dependencyDialog, setDependencyDialog] = useState(false),
    [demo, setDemo] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [board, setBoard] = useState(true);
  const navRef = useRef<HTMLElement>(null);
  const load = useCallback(async (id?: string, selected?: string) => {
    try {
      const me = await api<Person>("/me");
      const list = await api<Project[]>("/projects");
      const saved=localStorage.getItem(`teamflow.workspace.${me.id}`);
      const target = id ?? (list.some(p=>p.id===saved)?saved:undefined) ?? list[0]?.id;
      if (target) {
        localStorage.setItem(`teamflow.workspace.${me.id}`,target);
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
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setData(null);
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    // State updates in load happen after network responses, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(()=>{
    if(!user||!data||taskId||proposalId||manageTask||workspaceSetup||view==='settings')return;
    const update=()=>{if(document.visibilityState==='visible')void load(data.project.id);};
    const timer=window.setInterval(update,20_000);
    window.addEventListener('focus',update);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);};
  },[user,data,taskId,proposalId,manageTask,workspaceSetup,view,load]);
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
  function navigate(next: View) {
    router.push(next === "team" ? "/capacity" : `/${next}`);
    setMenu(false);
    setQuery("");
    setFilter("all");
    setNotice("");
  }
  async function selectTask(id: string) {
    try {
      setGraph(
        await api<Graph>(
          `/projects/${data?.project.id}/dependencies?selected=${id}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
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
      <div className="initial">
        <Brand />
        <Busy text="Opening your workspace…" />
      </div>
    );
  if (!user) return <Login onLogin={() => load()} initialError={error} />;
  const activeRisks = risks.filter((r) => r.active),
    pending = proposals.filter((p) => p.status === "pending"),
    ready = pending.filter((p) => !p.stale);
  const lead = data?.project.role === "lead";
  const currentTask = data?.tasks.find((t) => t.id === taskId),
    currentRisk = risks.find((r) => r.id === riskId),
    currentProposal = proposals.find((p) => p.id === proposalId);
  const shownTasks =
    data?.tasks.filter(
      (t) =>
        (filter === "all" || t.status === filter) &&
        `${t.title} ${t.key}`.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
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
        <div className="workspace-switch">
          <span className="workspace-emblem">{data?.project.name[0]??'T'}</span>
          <div>
            <strong>{data?.project.name??'Your workspace'}</strong>
            <small>Delivery workspace</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <button className="nav-item" onClick={()=>{setMenu(false);setWorkspaceSetup(true);}}><Plus size={19}/>Create or join workspace</button>
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
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={21} />
            <strong>Human-led. Evidence-backed.</strong>
            <p>Your team stays in control of every plan change.</p>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
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
                setBusy(true);
                navigate("overview");
                void load(e.target.value);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <i />
              {integrations?.ai_provider === "gemini" ? "Supabase workspace" : "Local workspace"}
            </span>
            <div className="avatar-stack">
              {data?.members.slice(0, 3).map((m, i) => (
                <span
                  key={m.id}
                  className={`avatar small color-${i}`}
                  title={m.name}
                >
                  {m.name[0]}
                </span>
              ))}
              <span className="team-count">
                +{Math.max(0, (data?.members.length ?? 0) - 3)}
              </span>
            </div>
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
            <section className="panel settings-panel"><h1>Start your team’s workspace</h1><p>Create an empty workspace for your real work, or accept an invitation from a teammate.</p><button className="primary" onClick={()=>setWorkspaceSetup(true)}>Create or join workspace</button></section>
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
                <span>{data.fixture_label}</span>
              </div>
              <div className="view-content" key={view}>
                {view === "overview" && (
                  <>
                    <section className="stats" aria-label="Delivery statistics">
                      {[
                        {
                          label: "Active risks",
                          value: activeRisks.length,
                          icon: TriangleAlert,
                          note: activeRisks.length
                            ? "Signals requiring attention"
                            : "No active risk signals",
                          color: "red",
                          target: "risks",
                        },
                        {
                          label: "Blocked tasks",
                          value: data.counts.blocked,
                          icon: Columns3,
                          note: `${data.counts.in_progress} tasks in progress`,
                          color: "amber",
                          target: "tasks",
                        },
                        {
                          label: "Pending decisions",
                          value: ready.length,
                          icon: Inbox,
                          note: ready.length
                            ? "Ready for human review"
                            : "Your decision queue is clear",
                          color: "teal",
                          target: "decisions",
                        },
                        {
                          label: "Completed tasks",
                          value: data.counts.done,
                          icon: CheckCheck,
                          note: `of ${data.counts.total} tasks in the plan`,
                          color: "blue",
                          target: "tasks",
                        },
                      ].map((s) => (
                        <button
                          className={`stat ${s.color}`}
                          key={s.label}
                          onClick={() => {
                            navigate(s.target as View);
                            if (s.label === "Blocked tasks")
                              setFilter("blocked");
                          }}
                        >
                          <div>
                            <span>{s.label}</span>
                            <s.icon size={20} />
                          </div>
                          <strong>{String(s.value).padStart(2, "0")}</strong>
                          <small>
                            {s.note}
                            <ArrowUpRight size={14} />
                          </small>
                        </button>
                      ))}
                    </section>
                    <div className="overview-grid">
                      <DependencyMap
                        graph={graph}
                        risks={risks}
                        onSelect={selectTask}
                        onOpen={() => navigate("dependencies")}
                      />
                      <section className="panel insight">
                        <div className="insight-head">
                          <span className="insight-icon">
                            <Sparkles size={21} />
                          </span>
                          <span className="section-kicker">
                            RECOVERY ASSISTANT
                          </span>
                          {activeRisks[0] && (
                            <Badge value={activeRisks[0].severity} />
                          )}
                        </div>
                        {activeRisks[0] ? (
                          <>
                            <h2>
                              Turn a signal into{" "}
                              <br />a clear next step.
                            </h2>
                            <p>{activeRisks[0].evidence.title}</p>
                            <div className="insight-evidence">
                              <FileText size={18} />
                              <div>
                                <strong>Source evidence attached</strong>
                                <small>
                                  {["seed", "replay"].includes(activeRisks[0].evidence.origin)
                                    ? "Replayed sample · "
                                    : ""}
                                  {activeRisks[0].affected_task_ids.length}{" "}
                                  downstream tasks
                                </small>
                              </div>
                            </div>
                            <p className="insight-reason">
                              {activeRisks[0].reason}
                            </p>
                            <button
                              className="primary"
                              onClick={() => setRiskId(activeRisks[0].id)}
                            >
                              Review risk & recovery
                              <ArrowRight size={17} />
                            </button>
                          </>
                        ) : (
                          <>
                            <h2>
                              A clear view.{" "}
                              <br />A calmer delivery.
                            </h2>
                            <p>
                              No active risk signals have been recorded. Your
                              task plan is ready for the next update.
                            </p>
                            <div className="readiness-line">
                              <Check size={17} />
                              Dependency graph connected
                            </div>
                            <div className="readiness-line">
                              <Check size={17} />
                              Human approval enforced
                            </div>
                            {lead && (
                              <button
                                className="primary"
                                onClick={() => setDemo(true)}
                              >
                                <Play size={16} />
                                Explore a demo scenario
                              </button>
                            )}
                          </>
                        )}
                        <div className="human-note">
                          <ShieldCheck size={16} />
                          <span>
                            Suggestions only. You approve every protected
                            change.
                          </span>
                        </div>
                      </section>
                    </div>
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
                            {pending.slice(0, 3).map((p) => (
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
                        title="No matching risks"
                        description="Try another filter, or replay a labeled demo event to explore the workflow."
                      />
                    )}
                  </section>
                )}
                {view === "tasks" && (
                  <>
                    {lead && integrations?.ai_provider === "gemini" && <div className="section-actions"><button className="primary" onClick={() => setManageTask("new")}>Create task</button></div>}
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
                                      {person(t.owner_id)?.name[0]}
                                    </span>
                                    <span>{person(t.owner_id)?.name}</span>
                                    <span>{t.estimate_hours}h</span>
                                  </footer>
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
                        title="No matching tasks"
                        description="Try another title or clear your filters."
                      />
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
                        disabled={data.project.role === "viewer"}
                        onClick={() => setDependencyDialog(true)}
                      >
                        <Plus size={16} />
                        Propose dependency
                      </button>
                    </div>
                    <DependencyMap
                      graph={graph}
                      risks={risks}
                      onSelect={selectTask}
                      expanded
                    />
                    {graph.selected_task_id && (
                      <div className="selection-card">
                        <div>
                          <h3>
                            {
                              data.tasks.find(
                                (t) => t.id === graph.selected_task_id,
                              )?.title
                            }
                          </h3>
                          <p>
                            {graph.upstream_ids.length} upstream ·{" "}
                            {graph.downstream_ids.length} downstream tasks
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setTaskId(graph.selected_task_id)}
                        >
                          Open task
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    )}
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
                        title="Your queue is clear"
                        description="Open a risk to generate a proposal, or propose a change from a task."
                      />
                    )}
                  </section>
                )}
                {view === "team" && (
                  <>
                    {data.project.role !== "viewer" && data.members.find((m) => m.id === user.id) && (
                      <AvailabilityForm
                        dated={integrations?.ai_provider === "gemini"}
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
                    {integrations.ai_provider==='gemini'&&<WorkspaceSettings key={data.project.id} id={data.project.id} onSaved={refresh}/>}
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
                            {integrations.github_configured
                                ? "Workflow evidence imported by an operator. Sync is manual; check source timestamps."
                              : "No live repository connection. Demo events are labeled."}
                          </p>
                        </div>
                        <Badge
                          value={
                            integrations.github_configured
                                ? "manual sync"
                              : "not connected"
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
      {workspaceSetup&&<WorkspaceSetup displayName={user.name} onClose={()=>setWorkspaceSetup(false)} onSaved={async id=>{await load(id);router.push('/overview');}}/>}
      {manageTask && data && <TaskManager data={data} task={data.tasks.find(t => t.id === manageTask)} onClose={() => setManageTask(null)} onSaved={refresh} />}
      {currentRisk && data && integrations && (
        <RiskDialog
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
          onClose={() => setProposalId(null)}
          onDecided={async () => {
            await refresh();
            setNotice(
              "Decision recorded. The current plan and audit log are up to date.",
            );
          }}
        />
      )}
      {dependencyDialog && data && (
        <DependencyDialog
          data={data}
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
          onClose={() => setDemo(false)}
          onReplay={async (kind, task) => {
            await api(`/projects/${data.project.id}/demo-events`, {
              method: "POST",
              body: JSON.stringify({
                kind,
                task_id: task,
                event_key: crypto.randomUUID(),
              }),
            });
            await refresh();
            setDemo(false);
            navigate("risks");
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
        </p>
      </div>
      <Badge value={risk.active ? risk.severity : "resolved"} />
      <ChevronRight size={16} />
    </button>
  );
}
function DemoDialog({
  data,
  onClose,
  onReplay,
}: {
  data: Overview;
  onClose: () => void;
  onReplay: (kind: string, task: string) => Promise<void>;
}) {
  const [kind, setKind] = useState("ci_failure"),
    [task, setTask] = useState(
      data.tasks.find((t) => t.key === "LOGIN-102")?.id ?? data.tasks[0].id,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run() {
    setBusy(true);
    try {
      await onReplay(kind, task);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Replay a demo event" onClose={onClose}>
      <div className="demo-disclosure">
        <Play size={20} />
        <p>
          These are fictional sample events for exploring the workflow. They are
          never presented as live GitHub activity.
        </p>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <label className="field">
        Scenario
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="ci_failure">CI check fails</option>
          <option value="review_delay">PR review waits 48 hours</option>
          <option value="capacity">Owner unavailable for two days</option>
          <option value="ci_pass">CI check passes again</option>
        </select>
      </label>
      <label className="field">
        Linked task
        <select value={task} onChange={(e) => setTask(e.target.value)}>
          {data.tasks
            .filter((t) => t.status !== "done")
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.key} · {t.title}
              </option>
            ))}
        </select>
      </label>
      <button className="primary" disabled={busy} onClick={run}>
        {busy ? (
          <Busy text="Recording sample event…" />
        ) : (
          <>
            <Play size={16} />
            Replay event
          </>
        )}
      </button>
    </Modal>
  );
}
