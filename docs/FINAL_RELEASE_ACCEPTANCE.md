# Final product hardening release candidate

Scope: preserve working auth, workspace security and data model. Improve app chrome, team navigation, capacity, invitation action and demo walkthrough. Production changes require green CI and live acceptance. No production migrations or demo seeding.

## Release gates
- GitHub: backend + Supabase tests, frontend unit/build, desktop/mobile role smoke, Docker.
- Browser: actual owner and invited member, confirm/resend, join, task edit, dependency proposal, approval/rejection, audit, capacity, invitations. Test only authorized isolated fixtures.
- Demo: replay CI failure, dependency cascade, review delay, capacity and recovery; evidence marked fictional; plan unchanged until approval. Hosted demo availability and real GitHub/Gemini configuration are independent of simulated tests.
- Production: confirm exact commit/alias, check runtime errors, verify sender credentials, actual delivery and workspace membership. No claim of completed live acceptance before evidence.
