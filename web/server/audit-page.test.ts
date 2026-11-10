import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { auditPage } from "./audit-page";
import type { Client } from "./state";
function client(member = true) {
  const membership = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: member ? { user_id: "user" } : null }) };
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(), then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [
    { id: "11111111-1111-4111-8111-111111111111", created_at: "2026-11-10T01:00:00.123456+00:00" },
    { id: "11111111-1111-4111-8111-111111111110", created_at: "2026-11-10T01:00:00.123456+00:00" },
  ] }).then(resolve) };
  const from = vi.fn((table: string) => table === "tf_memberships" ? membership : query);
  return { instance: { from } as unknown as Client, from, query };
}
it('retains timestamp precision and UUID tie-breaking across pages', async () => {
  const c = client();
  const first = await auditPage(c.instance, "workspace", "user", new URLSearchParams("limit=1"));
  expect(first.items).toHaveLength(1);
  await auditPage(c.instance, "workspace", "user", new URLSearchParams({ limit: "1", cursor: first.next_cursor! }));
  expect(c.query.or).toHaveBeenCalledWith("created_at.lt.2026-11-10T01:00:00.123456+00:00,and(created_at.eq.2026-11-10T01:00:00.123456+00:00,id.lt.11111111-1111-4111-8111-111111111111)");
});
it('denies history without current membership before querying audit records', async () => {
  const c = client(false);
  await expect(auditPage(c.instance, "workspace", "user", new URLSearchParams())).rejects.toMatchObject({ status: 404 });
  expect(c.from).not.toHaveBeenCalledWith("tf_audit");
});
it('rejects cursor filter injection before database access', async () => {
  const c = client();
  const cursor = Buffer.from(JSON.stringify({ at: "2026-11-10T01:00:00Z),id.neq.null", id: "11111111-1111-4111-8111-111111111111" })).toString("base64url");
  await expect(auditPage(c.instance, "workspace", "user", new URLSearchParams({ cursor }))).rejects.toMatchObject({ status: 422 });
  expect(c.from).not.toHaveBeenCalled();
});
