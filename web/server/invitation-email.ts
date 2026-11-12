import { sendGmailInvitation, validMailbox, type GmailSender } from "./gmail-smtp";
/** Server-side transactional email adapter. No secrets, provider payloads or tokens are logged. */
export type InvitationEmailStatus = "accepted" | "not_configured" | "unconfirmed" | "not_requested";
type Config = { RESEND_API_KEY?: string; TEAMFLOW_INVITE_EMAIL_FROM?: string; APP_BASE_URL?: string; TEAMFLOW_GMAIL_USER?: string; TEAMFLOW_GMAIL_APP_PASSWORD?: string };
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
function gmailConfigured(config:Config):boolean {
 return Boolean(config.TEAMFLOW_GMAIL_USER&&validMailbox(config.TEAMFLOW_GMAIL_USER)&&config.TEAMFLOW_GMAIL_USER.toLowerCase().endsWith("@gmail.com")&&/^[a-zA-Z0-9]{16}$/.test(config.TEAMFLOW_GMAIL_APP_PASSWORD?.replace(/\s/g,"")??""));
}
export function invitationEmailConfigured(config: Config): boolean {
 return Boolean(baseURL(config)&&(gmailConfigured(config)||(config.RESEND_API_KEY?.trim()&&config.TEAMFLOW_INVITE_EMAIL_FROM?.trim())));
}
export function invitationURL(token: string, config: Config): string | null {
  const base = baseURL(config);
  if (!base || !/^[a-f0-9]{64}$/.test(token)) return null;
  return new URL("/join#" + token, base).toString();
}

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]??ch));
export function invitationEmailHTML(input:InvitationEmail,link:string):string {
 const workspace=escapeHtml(input.workspace),email=escapeHtml(input.email),role=escapeHtml(input.role),url=escapeHtml(link);
 return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>TeamFlow Guard</title></head><body style=\"margin:0;padding:0;background:#edf3f7;font-family:Arial,Helvetica,sans-serif;color:#142638\"><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#edf3f7\"><tr><td align=\"center\" style=\"padding:32px 12px\"><table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:560px;background:#fff;border:1px solid #dce5eb;border-radius:16px;overflow:hidden\"><tr><td style=\"background:#092133;padding:26px 28px;color:#fff\"><div style=\"font-size:12px;font-weight:bold;letter-spacing:2px;color:#7af1df\">TEAMFLOW GUARD</div><div style=\"font-size:23px;line-height:1.25;font-weight:bold;margin-top:10px\">See risks early.<br>Keep humans in control.</div></td></tr>"+`<tr><td style="padding:30px 28px"><div style="font-size:11px;font-weight:bold;letter-spacing:1.8px;color:#087f81">WORKSPACE INVITATION</div><h1 style="font-size:26px;line-height:1.25;margin:12px 0 14px;color:#122b3c">You're invited to join a team</h1><p style="font-size:15px;line-height:1.75">Collaborate on <strong>${workspace}</strong> in TeamFlow Guard.</p><div style="border:1px solid #dce5eb;border-radius:10px;padding:16px;margin:18px 0;color:#233f50;font-size:14px;line-height:1.8"><strong>Workspace:</strong> ${workspace}<br><strong>Access role:</strong> ${role}<br><strong>Invited email:</strong> ${email}</div><p style="font-size:14px;line-height:1.7">Sign in or create an account using the invited email address, then accept this private invitation.</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#087f81;border-radius:9px"><a href="${url}" style="display:inline-block;padding:15px 26px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold">Join workspace &rarr;</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#526778;margin-top:22px">This link is bound to your email and expires in seven days. Do not forward it. If you did not expect this invitation, ignore this message.</p></td></tr>`+"<tr><td style=\"padding:22px 28px;border-top:1px solid #e3eaf0;background:#f6f9fb;font-size:12px;line-height:1.7;color:#526778\"><strong>TeamFlow Guard</strong><br>Secure workspace collaboration · Automated account notification<br><a href=\"https://teamflow-guard.vercel.app\" style=\"color:#087f81\">teamflow-guard.vercel.app</a></td></tr></table></td></tr></table></body></html>";
}
export async function sendInvitationEmail(input: InvitationEmail, config: Config, transport: typeof fetch = fetch, gmail: GmailSender = sendGmailInvitation): Promise<InvitationEmailStatus> {
  const link = invitationURL(input.token, config);
  if (!invitationEmailConfigured(config) || !link) return "not_configured";
  const subject="You’re invited to TeamFlow Guard";
  const text="You have been invited to join " + input.workspace.replace(/[\r\n]/g, " ") +
    " as a " + input.role + ". Sign in or register using " + input.email +
    ", then open this private link:\n\n" + link +
    "\n\nThe link is bound to your email and expires in seven days. Do not forward it. If you did not expect this invitation, ignore this message.";
  const html=invitationEmailHTML(input,link);
  try {
    if(gmailConfigured(config)){
      const accepted=await gmail({from:config.TEAMFLOW_GMAIL_USER!,to:input.email,subject,text,html},config.TEAMFLOW_GMAIL_APP_PASSWORD!.replace(/\s/g,""));
      return accepted?"accepted":"unconfirmed";
    }
    // Only authorized email-bound invitations reach the configured provider.
    const result=await transport("https://api.resend.com/emails",{
      method:"POST",headers:{Authorization:"Bearer "+config.RESEND_API_KEY!.trim(),"Content-Type":"application/json","Idempotency-Key":"teamflow-invite/"+input.id},
      redirect:"error",signal:AbortSignal.timeout(8000),cache:"no-store",
      body:JSON.stringify({from:config.TEAMFLOW_INVITE_EMAIL_FROM!.trim(),to:[input.email],subject,html,text})
    });
    return result.ok?"accepted":"unconfirmed";
  }catch{return "unconfirmed";}
}
