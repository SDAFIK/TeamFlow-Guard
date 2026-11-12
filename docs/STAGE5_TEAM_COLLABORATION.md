# Stage 5 — team collaboration (review)
 
## Included
- Optional **direct invitation delivery** via Resend. In Settings, select an email and role, optionally check **Send invitation email now**, and generate an invite. The existing authorized email-bound RPC creates the invite first; the server then attempts delivery using the returned email, invitation ID and fresh token. The link is still available to copy. Demo workspaces never send.
- **Renew invitation** for expired or revoked invitations pre-fills the original recipient and permitted role; generate a new private link. For an active lost invitation, explicitly revoke it first. Old tokens cannot be recovered; the database stores only hashes. Accepted invitations are not renewable. Existing role and rate limits apply.
- Search teammates by name/email, existing owner-only role controls, recent saved activity from the workspace audit log, and 20-second visible-page polling with focus refresh, preserved graph selection and stale-response protection. This is polling, not push/websocket realtime. No new database tables or migration in Stage 5.
 
## Optional provider setup (no paid resources authorized)
The application works without an email provider. To enable actual delivery, configure a free Resend account with a verified sending domain you control. A free account does not imply a free custom domain; do not purchase one without approval. Use a sending-only API key scoped to that domain. In the existing project's protected server environment, set RESEND_API_KEY, TEAMFLOW_INVITE_EMAIL_FROM and APP_BASE_URL (canonical HTTPS origin, no path). Never expose these credentials to client code, GitHub or chat. Disable email link tracking to preserve invitation privacy. Only send test mail to an authorized recipient. A successful provider response is an acceptance, not an inbox-delivery receipt; delivery status webhooks are not included. For a restricted test sender, use only the provider-authorized test recipient.
 
## Validation and release gates
- Run existing unit, lint, typecheck, production build, disposable SQL and desktop/mobile smoke tests. New provider tests use injected mock fetch and never send email.
- Verify Stage 4 first, including its database migration and two-user authenticated acceptance. Stage 5 is stacked on Stage 4 and must not bypass those gates.
- On a separate local Supabase environment, test owner/manager/viewer permissions, invitation create/join/revoke/renew, two browser contexts, activity and refresh, workspace switching, and no email sends from fictional workspaces. Verify one real email only after provider and recipient authorization.
- No provider account, paid branch, production migration or Vercel production release has been created by this change.
 
## Provider reference
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://resend.com/pricing
 
## Deferred
Durable per-user notification read state, delivery status persistence/webhooks, real-time subscriptions, teammate removal and automatic rotation of an active invitation require separate design and security tests. Private GitHub and CI webhooks remain Stage 6.
