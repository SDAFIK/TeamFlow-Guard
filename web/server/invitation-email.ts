/** Server-side transactional email adapter. No secrets, provider payloads or tokens are logged. */
export type InvitationEmailStatus = "accepted" | "not_configured" | "unconfirmed" | "not_requested";
type Config = { RESEND_API_KEY?: string; TEAMFLOW_INVITE_EMAIL_FROM?: string; APP_BASE_URL?: string };
export type InvitationEmail = {
  id: string; email: string; role: "manager" | "member" | "viewer"; workspace: string; token: string;
};
function baseURL(config: Config): URL | null {
  try {
    const url = new URL(config.APP_BASE_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}
export function invitationEmailConfigured(config: Config): boolean {
  return Boolean(config.RESEND_API_KEY?.trim() && config.TEAMFLOW_INVITE_EMAIL_FROM?.trim() && baseURL(config));
}
export function invitationURL(token: string, config: Config): string | null {
  const base = baseURL(config);
  if (!base || !/^[a-f0-9]{64}$/.test(token)) return null;
  return new URL("/join#" + token, base).toString();
}
export async function sendInvitationEmail(input: InvitationEmail, config: Config, transport: typeof fetch = fetch): Promise<InvitationEmailStatus> {
  const link = invitationURL(input.token, config);
  if (!invitationEmailConfigured(config) || !link) return "not_configured";
  try {
    // Only an email-bound invite created by the authenticated workspace RPC reaches this call.
    // Do not redirect or send arbitrary HTML or credentials to a user-supplied URL.
    const result = await transport("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.RESEND_API_KEY!.trim(),
        "Content-Type": "application/json",
        "Idempotency-Key": "teamflow-invite/" + input.id,
      },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      body: JSON.stringify({
        from: config.TEAMFLOW_INVITE_EMAIL_FROM!.trim(),
        to: [input.email],
        subject: "Your TeamFlow Guard invitation",
        text: "You have been invited to join " + input.workspace.replace(/[\r\n]/g, " ") +
          " as a " + input.role + ". Sign in or register using " + input.email +
          ", then open this private link:\n\n" + link +
          "\n\nThe link is bound to your email and expires in seven days. Do not forward it. " +
          "If you did not expect this invitation, ignore this message.",
      }),
    });
    // Accepted by the provider is not delivered to the inbox. Do not read or log provider error bodies.
    return result.ok ? "accepted" : "unconfirmed";
  } catch { return "unconfirmed"; }
}
