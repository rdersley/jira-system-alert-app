# System Alert Manager v3.6.0

v3.6.0 adds a Jira **Issue Panel** entry for System Alert Manager while preserving the existing issue-action menu workflow.

On eligible SD P1/P2 issues the panel provides a compact incident communications summary:

- Client
- Priority
- Eligible contact count
- Next Update Due
- Last communication
- Recent communication history
- **Send System Alert** button

The button opens the existing Custom UI alert modal, so the proven email, SMS, recipient isolation, preview and audit logic is reused rather than duplicated.

The existing `••• > Send System Alert` issue action remains in place as a fallback during testing.

See `UPGRADE-INSTRUCTIONS.txt` for deployment steps.


## v3.6.0 - Configurable alert priorities

System Alert priorities are no longer hard-coded to P1/P2. Jira admins can configure one or more priority names in **System Alert Contacts → App settings**. Each priority has:

- Jira priority name (must match the Jira priority name exactly)
- Display label used in email/SMS/UI
- Notification colour

The selected priorities control:

- visibility of the Jira issue action and System Alert issue panel
- backend preview/send validation
- which priority options can be assigned to contacts
- notification labels and colour treatment

The app stores the project/priority display configuration in a Forge app property so Jira expressions can dynamically control issue-module visibility. The backend independently validates the current project and priority before any communication is sent.

**Important:** v3.6.0 adds the `write:app-data:jira` scope, so the first deployment may require Forge major-version approval and `forge install --upgrade`.
