export type DeliveryFocusKind =
  | "decision"
  | "risk"
  | "create-task"
  | "view-tasks"
  | "connect-tasks"
  | "view-dependencies"
  | "monitor";

export type DeliverySnapshot = {
  role: "lead" | "contributor" | "reviewer" | "viewer";
  tasks: number;
  connections: number;
  activeRisks: number;
  pendingDecisions: number;
};

export function getDeliveryFocus(snapshot: DeliverySnapshot): {
  kind: DeliveryFocusKind;
  eyebrow: string;
  heading: string;
  description: string;
  action: string;
} {
  const canManage = snapshot.role === "lead";
  const canContribute = snapshot.role !== "viewer";

  if (snapshot.pendingDecisions > 0) {
    return {
      kind: "decision", eyebrow: "NEEDS A DECISION",
      heading: `${snapshot.pendingDecisions} plan ${snapshot.pendingDecisions === 1 ? "change is" : "changes are"} waiting`,
      description: canManage
        ? "Compare the before-and-after details, then approve or reject. Nothing changes without your decision."
        : "A plan change is awaiting review from an authorized team lead. You can inspect the proposal.",
      action: canManage ? "Review pending decision" : "View decision",
    };
  }
  if (snapshot.activeRisks > 0) {
    return {
      kind: "risk", eyebrow: "ATTENTION NEEDED",
      heading: `${snapshot.activeRisks} active delivery ${snapshot.activeRisks === 1 ? "risk" : "risks"}`,
      description: "Inspect the observed signal and which tasks depend on it. Compare recovery options before proposing a change.",
      action: "Review top risk",
    };
  }
  if (snapshot.tasks < 2) {
    if (canManage) return {
      kind: "create-task", eyebrow: "BUILD YOUR PLAN",
      heading: snapshot.tasks === 0 ? "Start with your first task" : "Add one more task",
      description: snapshot.tasks === 0
        ? "Create a task with a clear owner. Your workspace stays empty until you add real work."
        : "Two tasks are enough to show how an upstream delay affects dependent work.",
      action: snapshot.tasks === 0 ? "Create first task" : "Create another task",
    };
    return {
      kind: "view-tasks", eyebrow: "GET ORIENTED", heading: snapshot.tasks ? "Your plan is taking shape" : "Waiting for the first task",
      description: "Explore the task board. A workspace lead can add and assign tasks.", action: "Open task board",
    };
  }
  if (snapshot.connections === 0) {
    return canContribute
      ? { kind: "connect-tasks", eyebrow: "SHOW WHAT DEPENDS ON WHAT", heading: "Connect the work", description: "Create a reviewable dependency so your team can see the impact of a blocked task.", action: "Propose a dependency" }
      : { kind: "view-dependencies", eyebrow: "EXPLORE YOUR PLAN", heading: "Understand the task sequence", description: "No dependencies are connected yet. Explore the list while a teammate prepares the plan.", action: "View dependencies" };
  }
  return {
    kind: "monitor", eyebrow: "PLAN IN VIEW", heading: "Your delivery plan is ready to track",
    description: "Your team can update task status and availability. New evidence-backed risks will appear when a rule is triggered.",
    action: "Review task board",
  };
}

export function getDeliveryProgress({ total, done }: { total: number; done: number }) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.max(0, Math.min(done, safeTotal));
  return {
    percentage: safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100),
    caption: safeTotal === 0 ? "Add a task to begin tracking progress" : `${safeDone} of ${safeTotal} tasks completed`,
  };
}
