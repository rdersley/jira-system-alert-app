# System Alert Manager v3.9.2

System Alert Manager for Jira Service Management provides controlled client-isolated incident communications by email and SMS.

## v3.9.2 highlights

- Jira project and field mapping by friendly Jira names rather than raw IDs.
- Issue Start Time and Next Update Due are genuinely optional mappings; agents can use manual entry when no Jira field is mapped.
- Microsoft 365 has a Marketplace Easy Connect mode designed to use vendor-managed multi-tenant Entra credentials, plus the existing Enterprise manual mode.
- Optional incident-field mappings that create template tokens such as `{{field.impact}}`.
- Email provider selection between SendGrid and Microsoft 365 / Microsoft Graph.
- Microsoft 365 configuration stored securely in Forge KVS secrets.
- Built-in Microsoft IT request text to simplify the one-time Entra setup request.
- Provider test email action.
- Existing SendGrid and Twilio configuration remains supported.
- Existing branding, embedded logo, client isolation, priority configuration, monthly test, templates, and communication history remain intact.

## Microsoft 365 mode

Microsoft 365 mode uses Microsoft Graph application authentication. The Microsoft administrator provides Tenant ID, Client ID, Client Secret, and grants Microsoft Graph Application `Mail.Send` permission with admin consent. The app then sends through the configured Exchange Online mailbox. No mailbox read permission is required by System Alert Manager.

## Development deployment

Run `deploy-dev.ps1` from the project root. If Forge requests a major-version approval because of the new Microsoft Graph external egress configuration, run the approval command shown by Forge, then run `forge install --upgrade`.


## v3.9.2 Microsoft 365 Easy Connect
- Easy Connect and Enterprise manual settings are now visually separated.
- Easy Connect provides Connect, Verify, Reconnect and Disconnect actions.
- Microsoft admin consent uses the v2.0 admin-consent endpoint with Graph .default scope.
- Easy Connect is only considered Ready after Mail.Send consent is verified.
- A successful Microsoft test email records the last successful test time.


## v3.9.2 Easy Connect UX
- Removes Tenant ID, Client ID and client secret from normal Microsoft 365 Easy Connect.
- Easy Connect starts with one Connect Microsoft 365 button; Microsoft identifies the organisation during the publisher-managed flow.
- Enterprise manual remains as the advanced customer-managed Entra option.
- Publisher-side Microsoft app registration remains a one-time Marketplace prerequisite, not a per-customer setup step.

## v3.9.3 automated testing
Run `./test-dev.ps1` for a no-deploy validation pass. It runs regression/safety tests, builds all three Custom UIs, and runs Forge lint.

`./deploy-dev.ps1` now runs the automated tests first and stops before deployment if a test fails.

### Mock provider mode (development only)
Set the Forge environment variable `SYSTEM_ALERT_MOCK_PROVIDERS=true` in a development environment to prevent real SendGrid/Microsoft 365/Twilio sends while exercising the send workflow. Never enable this in production. Mock mode is opt-in and disabled by default.


## v3.9.5 — Microsoft 365 Enterprise connection & testing

- Added Save & verify Microsoft 365 for Enterprise manual configuration.
- Verifies the client-credentials token and confirms the Mail.Send application role is present.
- Shows verified sender, last verification and last successful test email.
- Added optional client-secret expiry tracking and warning.
- Test email updates the verified Microsoft connection state.
- Client secrets continue to be stored only in encrypted Forge secret storage.
