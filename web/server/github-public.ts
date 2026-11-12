/** Public repositories only. No OAuth tokens or private repository credentials are collected. */
export function repositorySlug(input: string): string {
  const value = input.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/$/, "").replace(/\.git$/i, "");
  if (!/^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d._-]{1,100}$/i.test(value) || value.includes("..")) {
    throw new Error("Enter a public repository as owner/name or https://github.com/owner/name.");
  }
  return value;
}

export type PublicRun = {
  id: number; name: string; status: string; conclusion: string | null;
  html_url: string; created_at: string; head_branch: string | null;
};

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "TeamFlow-Guard",
};

export async function verifyPublicRepository(input: string): Promise<string> {
  const slug = repositorySlug(input);
  const response = await fetch(`https://api.github.com/repos/${slug}`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Repository not found or not public." : "GitHub could not verify the repository right now.");
  const data = await response.json() as { full_name?: string; private?: boolean; archived?: boolean };
  if (data.private || !data.full_name || repositorySlug(data.full_name).toLowerCase() !== slug.toLowerCase()) {
    throw new Error("Only an accessible public GitHub repository can be linked without OAuth.");
  }
  return data.full_name;
}

export async function recentPublicRuns(slug: string, branch: string): Promise<PublicRun[]> {
  const params = new URLSearchParams({ branch, per_page: "5" });
  const response = await fetch(`https://api.github.com/repos/${repositorySlug(slug)}/actions/runs?${params}`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("GitHub Actions could not be loaded. The linked repository is unchanged.");
  const payload = await response.json() as { workflow_runs?: unknown[] };
  return (payload.workflow_runs ?? []).slice(0, 5).flatMap(raw => {
    const run = raw as Partial<PublicRun>;
    if (typeof run.id !== "number" || typeof run.html_url !== "string" ||
      !run.html_url.startsWith(`https://github.com/${repositorySlug(slug)}/actions/runs/`)) return [];
    return [{
      id: run.id, name: String(run.name ?? "Workflow"), status: String(run.status ?? "unknown"),
      conclusion: typeof run.conclusion === "string" ? run.conclusion : null,
      html_url: run.html_url, created_at: String(run.created_at ?? ""),
      head_branch: typeof run.head_branch === "string" ? run.head_branch : null,
    }];
  });
}
