# System Alert Manager v3.7.8

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


## v3.7.3

Branding and focused template management release.

- Added a dedicated Branding sub-section under Templates.
- Configure service/company name, logo URL, header colours, brand accent, email background, footer background, footer text and optional support link.
- Branding is inherited by all HTML alert emails without allowing administrators to break the responsive email structure.
- Templates are edited one alert type at a time: Initial Alert, Incident Update, Service Restored and Monthly Test.
- Added Preview Email and Preview SMS actions using sample incident data before saving.
- Added per-template reset to default and branding reset to default.
- No new Forge scopes. Existing SendGrid, Twilio, client isolation and Jira configuration remain unchanged.

## v3.7.3 preview fixes
- Branding is now applied to the admin Template/Branding email preview without relying on a nested iframe.
- Ticket-side Email Preview now uses the saved branding, logo URL, colours, footer and support link.
- Alert and issue-panel version labels now match the installed app release.


## v3.7.4 preview consistency
- Admin email previews now display the exact HTML produced by the same backend renderer used for outgoing email.
- Ticket preview and admin preview remain aligned with saved branding and templates.
- Broken logo images are hidden in browser previews instead of showing a broken-image icon.
- No changes to delivery provider configuration or recipient logic.


## v3.7.8 branding preview fix
- Ticket email preview no longer overrides saved header/footer branding colours with hard-coded CSS.
- Alert, admin, panel, backend and package version markers aligned to 3.7.8.


## v3.7.8 branding polish
- Header text colour now applies consistently to the service name and incident title in both admin and ticket previews.
- Preview logos that fail to load are hidden cleanly instead of showing a broken-image icon.
- Runtime version labels are aligned at v3.7.8.

## v3.7.8 uploaded branding logo

- Branding now supports a direct PNG/JPG logo upload (maximum 140 KB).
- The logo is stored per Forge installation rather than relying on an external website URL.
- Admin and ticket previews use the stored logo immediately.
- SendGrid emails embed the stored logo as an inline CID image so recipients do not depend on an external image host.
- The existing Logo URL remains available as an optional fallback.
- No additional Forge permission scopes are required.
