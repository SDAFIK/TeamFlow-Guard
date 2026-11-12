import { describe, expect, it, vi } from "vitest";
import { invitationEmailConfigured, invitationURL, sendInvitationEmail } from "./invitation-email";

const config = { RESEND_API_KEY: "fixture-only-key", TEAMFLOW_INVITE_EMAIL_FROM: "TeamFlow <invite@example.test>", APP_BASE_URL: "https://teamflow.example.test" };
const invite = { id: "test-id", email: "person@example.test", role: "member" as const, workspace: "Shared project", token: "a".repeat(64) };

describe("optional invitation delivery", () => {
  it("fails closed without complete configuration or an HTTPS origin", () => {
    expect(invitationEmailConfigured({})).toBe(false);
    for (const origin of ["http://localhost:3000", "https://evil.test/path", "https://u:p@example.test", "https://example.test?x=1", "https://example.test/#fragment"]) {
      expect(invitationEmailConfigured({ ...config, APP_BASE_URL: origin })).toBe(false);
    }
    expect(invitationURL("bad", config)).toBeNull();
  });
  it("uses only the configured canonical origin and a fragment token", () => {
    expect(invitationURL(invite.token, config)).toBe(config.APP_BASE_URL + "/join#" + invite.token);
  });
  it("does not call the network when unconfigured", async () => {
    const transport = vi.fn<typeof fetch>();
    expect(await sendInvitationEmail(invite, {}, transport)).toBe("not_configured");
    expect(transport).not.toHaveBeenCalled();
  });
  it("sends only to the bound recipient using a fixed endpoint and invite idempotency key", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"id":"fixture"}', { status: 200 }));
    expect(await sendInvitationEmail(invite, config, transport)).toBe("accepted");
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("teamflow-invite/test-id");
    const body = JSON.parse(String(init?.body));
    expect(body.to).toEqual([invite.email]);
    expect(body.text).toContain("/join#" + invite.token);
    expect(body.html).toBeUndefined();
  });
  it("preserves the invitation on provider rejection or a network failure", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 }));
    expect(await sendInvitationEmail(invite, config, transport)).toBe("unconfirmed");
    transport.mockRejectedValue(new Error("network"));
    expect(await sendInvitationEmail(invite, config, transport)).toBe("unconfirmed");
  });
});
