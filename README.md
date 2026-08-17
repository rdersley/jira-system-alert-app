# System Alert Manager v3.7.1

Marketplace-readiness configuration release based on the working v3.6.1 build.

## What is new
- Setup status dashboard showing Jira, client list, email, SMS and contact readiness.
- Communication provider configuration inside the app admin page.
- SendGrid sender, reply-to and API key configuration.
- Twilio Account SID, Auth Token/API key, sender number or Messaging Service SID and region configuration.
- Provider secrets are stored with Forge encrypted secret storage and are never returned to the browser after saving.
- Existing Forge environment variables remain supported as a fallback, so upgrading does not force an immediate credential migration.
- Editable customer communication templates for Initial Alert, Incident Update, Service Restored and Monthly Test.
- Editable email subject, introduction, follow-up and SMS wording.
- Template tokens: {{priority}}, {{jiraPriority}}, {{clientCode}}, {{issueKey}}, {{summary}}, {{startTime}}, {{nextUpdate}}, {{message}}, {{testMonth}}.
- Reset templates to System Alert defaults.
- Existing professional HTML email layout is retained; template editing changes the wording rather than exposing raw HTML.

## Preserved from v3.6.1
- Jira-driven Client field options and option-ID client isolation.
- Configurable System Alert priorities.
- SendGrid email and Twilio SMS delivery.
- Monthly first-Wednesday automatic test.
- Professional HTML email preview.
- Contact test email/SMS actions.
- Duplicate contact protection and grouped client contact management.
- Issue action/panel and backend recipient safety validation.

## Credential migration
You do not have to re-enter existing SendGrid or Twilio credentials immediately. v3.7.1 first checks encrypted provider settings saved in the app and then falls back to the existing Forge environment variables.

To migrate later, open System Alert Contacts > Communication providers and save the credentials there. Secret values are write-only in the admin UI.


## v3.7.1
Admin configuration is now split into General, Clients & Contacts, Communication Providers, Templates, and Monthly Test sections. Sending logic and provider storage remain unchanged.
