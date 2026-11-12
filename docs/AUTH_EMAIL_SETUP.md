# TeamFlow Guard email confirmation and invitation setup

## Hosted Supabase confirmation
In Authentication → URL Configuration set Site URL to https://teamflow-guard.vercel.app and allow both exact callback URLs:
- https://teamflow-guard.vercel.app/auth/callback
- https://teamflow-guard-sadib-dewans-projects.vercel.app/auth/callback

In Authentication → Emails → Confirm signup, subject: **Verify your email | TeamFlow Guard**. Paste the full HTML in `supabase/templates/confirm-signup.html`. Keep the ConfirmationURL variable intact. Save. This is a template for Supabase's hosted configuration; committing it does not activate it automatically.

The app allows on-demand resend for the same email with a 60-second client countdown and existing Supabase server-side limits. This is not a guarantee of 3 deliveries: SMTP quotas and recipient restrictions apply. Use the newest link in the same browser used for signup; email verification remains enabled. If email scanners consume single-use links, an explicit confirmation landing page or OTP flow should be tested separately.

## Invitation email
The optional Resend provider sends responsive HTML and plaintext with an email-bound link, escaped dynamic values and no remote images. Only the existing authorized invite endpoint triggers delivery. No provider account or sending domain has been configured here. Without provider credentials, copy/send the manual link. For real branded sender identity, configure verified sender domain and custom SMTP separately; no paid domain has been purchased. Turn off link tracking for auth mail and private invite links.

## Verification
After deployment and saving the hosted settings, register a fresh test email on the main URL, request one resend after the cooldown, click the newest email and sign in, then accept an email-bound invitation. Use authorized test recipients only; no secrets or real confirmation tokens in logs.
