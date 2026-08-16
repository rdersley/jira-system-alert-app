# System Alert Manager v3.6.1

Usability and recipient-safety update based on v3.6.0.

## Changes
- Loads client choices from the configured Jira Client custom field.
- Add/Edit Contact uses a Jira-driven client dropdown instead of free-text client code/name.
- Stores Jira client option ID/value/code/name on contacts.
- Recipient filtering prefers the Jira client option ID, with legacy code matching retained during migration.
- Duplicate email/mobile protection within the same Jira client.
- Provider status cards for SendGrid email and Twilio SMS.
- Individual Test Email / Test SMS actions for saved contacts.
- Current contacts grouped by Jira client with a filter box.
- Existing configurable priorities, monthly tests, email/SMS templates and issue workflow are preserved.

## Legacy contacts
Existing v3.6 contacts remain readable. Edit each legacy contact once and choose its Jira client to migrate it to option-ID matching.
