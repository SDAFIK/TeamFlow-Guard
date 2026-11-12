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
    expect(body.html).toContain("Join workspace");
    expect(body.html).toContain("/join#" + invite.token);
    expect(body.html).toContain("WORKSPACE INVITATION");
  });
  it("escapes workspace names instead of inserting untrusted markup",async()=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response("{}",{status:200}));
    await sendInvitationEmail({...invite,workspace:"<img src=x onerror=alert(1)>"},config,transport);
    const body=JSON.parse(String(transport.mock.calls[0][1]?.body));
    expect(body.html).toContain("&lt;img");
    expect(body.html).not.toContain("<img src=x");
  });
  it("uses Gmail only when configured and preserves recipient and link",async()=>{
    const transport=vi.fn<typeof fetch>();
    const gmail=vi.fn().mockResolvedValue(true);
    const cfg={APP_BASE_URL:config.APP_BASE_URL,TEAMFLOW_GMAIL_USER:"sender@gmail.com",TEAMFLOW_GMAIL_APP_PASSWORD:"abcd efgh ijkl mnop"};
    expect(invitationEmailConfigured(cfg)).toBe(true);
    expect(await sendInvitationEmail(invite,cfg,transport,gmail)).toBe("accepted");
    expect(gmail).toHaveBeenCalledWith(expect.objectContaining({from:"sender@gmail.com",to:invite.email,html:expect.stringContaining("/join#"+invite.token)}),"abcdefghijklmnop");
    expect(transport).not.toHaveBeenCalled();
    gmail.mockResolvedValue(false);
    expect(await sendInvitationEmail(invite,cfg,transport,gmail)).toBe("unconfirmed");
    expect(invitationEmailConfigured({...cfg,TEAMFLOW_GMAIL_APP_PASSWORD:""})).toBe(false);
  });
  it("preserves the invitation on provider rejection or a network failure", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 }));
    expect(await sendInvitationEmail(invite, config, transport)).toBe("unconfirmed");
    transport.mockRejectedValue(new Error("network"));
    expect(await sendInvitationEmail(invite, config, transport)).toBe("unconfirmed");
  });
});
