export type SetupAction = "create-task" | "invite-team" | "add-task" | "connect-work" | "explore-risks";

export type SetupSnapshot = {
  tasks: number;
  members: number;
  connections: number;
};

/** Only persisted workspace data determines which onboarding milestones are done. */
export function getSetupProgress(snapshot: SetupSnapshot) {
  const tasks = Math.max(0, snapshot.tasks);
  const members = Math.max(0, snapshot.members);
  const connections = Math.max(0, snapshot.connections);
  const milestones = [
    { id: "plan", complete: tasks > 0 },
    { id: "team", complete: members > 1 },
    { id: "connect", complete: connections > 0 },
  ] as const;
  const completed = milestones.filter((step) => step.complete).length;

  let next: SetupAction;
  if (tasks === 0) next = "create-task";
  else if (members < 2) next = "invite-team";
  else if (tasks < 2) next = "add-task";
  else if (connections === 0) next = "connect-work";
  else next = "explore-risks";

  return { milestones, completed, next, isComplete: completed === milestones.length };
}
