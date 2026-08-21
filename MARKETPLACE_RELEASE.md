# System Alert Manager v3.9.7 — Marketplace Release Candidate

## Release status
This branch is frozen for Marketplace release validation. Do not add new features before submission unless a release-blocking defect is found.

## Final development validation
1. `git pull`
2. `./test-dev.ps1`
3. `./deploy-dev.ps1`
4. Confirm System Alert Manager shows v3.9.7.
5. Re-open Setup guide and confirm the existing configuration is retained.
6. Preview and send one test alert by email.
7. Send one test SMS where Twilio is configured.
8. Confirm the internal Jira comment/audit entry is added.
9. Confirm a non-admin user cannot change app administration settings.
10. Confirm the alert action is hidden outside the configured project/priorities.

## Clean-site acceptance test
Before Marketplace submission, install the final build on a clean Jira/JSM Cloud test site and confirm:
- no project, client field or priority is pre-selected;
- the alert action is unavailable until Jira setup is completed;
- Setup guide can configure project, client field and priorities from scratch;
- Start Time and Next Update fields are optional mappings;
- a client/contact can be created;
- at least one email provider can be configured and tested;
- optional Twilio SMS can be configured and tested;
- initial, update and resolved alert flows work;
- recipient separation prevents cross-client delivery;
- configuration changes require Jira administrator permission.

## Production environment
Before `forge deploy -e production`, configure the required production-only provider values/secrets. Do not copy test credentials into production unless they are intentionally the production credentials.

Microsoft Easy Connect publisher-side values, where used:
- `MICROSOFT_MARKETPLACE_CLIENT_ID`
- `MICROSOFT_MARKETPLACE_CLIENT_SECRET`
- `MICROSOFT_MARKETPLACE_REDIRECT_URI`

Provider environment fallbacks, where used:
- `SENDGRID_API_KEY`
- `ALERT_FROM_EMAIL`
- `ALERT_FROM_NAME`
- `ALERT_REPLY_TO`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY` / `TWILIO_API_SECRET` or `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`

Do not enable `SYSTEM_ALERT_MOCK_PROVIDERS=true` in production.

## Marketplace configuration
- App name: System Alert Manager for Jira
- Version: 3.9.7
- Licensing: Paid via Atlassian / Forge licensing enabled
- External egress: Microsoft login, Microsoft Graph, SendGrid and Twilio as declared in `manifest.yml`
- Publish Privacy Policy, EULA/Terms, support policy and documentation before submission.
- Use screenshots containing fictitious data only.

## Merge gate
Merge PR #2 into `master` only after the final local tests and development smoke test pass.
