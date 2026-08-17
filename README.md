# System Alert Manager v3.8.0

System Alert Manager for Jira Service Management provides controlled client-isolated incident communications by email and SMS.

## v3.8.0 highlights

- Jira field mapping by field name rather than raw custom field IDs.
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
