# System Alert Manager v3.3.2

This Forge app provides client System Alert notifications from Jira Service Management.

## v3.1 changes

- System Alert Contacts admin page is now Custom UI for consistent rendering.
- Saved contacts have Edit, Save changes, Cancel and Delete controls.
- Admin settings include Client, Issue Start Time, Next Update Due, project and sender-name fields.
- Send System Alert display condition uses a single Jira expression: SD project AND Priority P1/P2.
- Backend independently refuses live alerts outside SD or priorities other than P1/P2.
- Internal JSM audit comments remain private (`public: false`).
- Existing Twilio Account SID/Auth Token/From Number configuration is unchanged.
- Existing SMS templates and Monthly Test support are preserved.

See UPGRADE-INSTRUCTIONS.txt for the upgrade commands.

## v3.3.2 changes

- Email is selected by default when the Send System Alert form opens, provided email is enabled in app settings.
- SMS via Twilio is selected by default when the form opens, provided SMS is enabled in app settings.
- All recipients eligible for the current client, priority and alert type are selected automatically when the form opens.
- Agents can still untick either delivery channel or individual recipients before sending.


## v3.3 email improvements
- Professional responsive HTML incident email template.
- P1 red, P2 amber, Service Restored green, Monthly Test amber/test-only styling.
- Alert-type-specific subject lines.
- Incident details panel with reference, customer, priority, issue start time, next update due, and status.
- Current Situation panel and Service Desk footer.
- Preview Email button in the ticket action before sending.
- SMS, recipient defaults, contact storage and Twilio behaviour are unchanged.

## v3.3.2 changes
- Makes the P1/P2 alert badge more prominent in both the preview and delivered HTML email.
- Adds a matching coloured P1/P2 pill in the Incident details table.
- Removes the redundant small SYSTEM ALERT eyebrow that could render awkwardly in previews.
- Persists Issue Start Time, Next Update Due and Current Situation while opening/closing Preview Email.
- Preview and send now use the same live form values so the email cannot revert to `Not specified` / `To be confirmed` after previewing.
