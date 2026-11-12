import { describe, expect, it } from "vitest";
import { repositorySlug, verifyPublicRepository, recentPublicRuns } from "./github-public";

describe("public GitHub repository linking", () => {
  it("accepts only bounded GitHub owner/repo references", () => {
    expect(repositorySlug("https://github.com/SDAFIK/TeamFlow-Guard.git")).toBe("SDAFIK/TeamFlow-Guard");
    expect(repositorySlug("SDAFIK/TeamFlow-Guard")).toBe("SDAFIK/TeamFlow-Guard");
    for (const bad of ["https://evil.test/owner/repo", "../secret", "owner/repo/extra", "http://127.0.0.1/x", "owner/..hidden"]) {
      expect(() => repositorySlug(bad)).toThrow();
    }
  });

  it("blocks private repositories instead of pretending OAuth exists", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ full_name: "Org/Secret", private: true }), { status: 200 });
    try { await expect(verifyPublicRepository("Org/Secret")).rejects.toThrow("Only an accessible public"); }
    finally { globalThis.fetch = oldFetch; }
  });

  it("returns only verified run URLs and limits the activity feed", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ workflow_runs: [
      {id:1,html_url:"https://github.com/org/repo/actions/runs/1",name:"CI",status:"completed",conclusion:"success",created_at:"2026-11-11"},
      {id:2,html_url:"https://untrusted.example/actions/runs/2",name:"Wrong"},
    ] }), {status:200});
    try { expect((await recentPublicRuns("org/repo","main")).map(run => run.id)).toEqual([1]); }
    finally { globalThis.fetch = oldFetch; }
  });
});
