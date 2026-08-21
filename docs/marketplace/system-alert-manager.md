# System Alert Manager for Jira Service Management

System Alert Manager helps Jira Service Management teams send controlled critical-incident communications directly from Jira.

## What it does

- Send incident alerts by email and SMS from Jira Service Management.
- Maintain client-specific contacts and distribution lists.
- Control recipients by configured Jira priority such as P1 and P2.
- Use reusable Initial Alert, Incident Update, Service Restored and Monthly Test templates.
- Populate messages with Jira issue data and optional mapped Jira fields.
- Send email through SendGrid or Microsoft 365.
- Send SMS through Twilio.
- Run scheduled communication tests for opted-in contacts.
- Review communication and monthly-test history.

## Setup

1. Open **Jira settings → Apps → System Alert Manager**.
2. In **General**, select the Jira Service Management project, the Client/Customer field, and the priorities that should use System Alert Manager.
3. In **Communication Providers**, configure an email provider and Twilio if SMS delivery is required.
4. In **Clients & Contacts**, add the contacts or distribution lists for each client and choose which alert priorities and channels they receive.
5. In **Templates**, review the default notification wording and branding, then customise it if required.
6. Use **Monthly Test** to review the scheduled communication-test configuration and history.

## Email providers

### SendGrid

Use a verified sender address and a SendGrid API key with Mail Send permission. Provider credentials entered in the app are stored using Forge encrypted secret storage and are not displayed again after saving.

### Microsoft 365

System Alert Manager supports Microsoft 365 through Microsoft Graph. Enterprise manual setup uses the customer's own Microsoft Entra application with Microsoft Graph **Application → Mail.Send** permission and an approved sender mailbox.

## SMS provider

SMS delivery uses Twilio. Configure the Twilio Account SID, authentication credentials, and either a sender number or Messaging Service SID as appropriate for the customer's Twilio account.

## Data handling

System Alert Manager stores its application configuration in Atlassian Forge storage. Contact records can include names, email addresses and mobile telephone numbers supplied by the customer administrator. Provider secrets are stored using Forge encrypted secret storage.

For full details see the [System Alert Manager privacy and data handling statement](privacy.md).

## Support

For support, email **support@nuvriqo.com**.

See the [Nuvriqo support information](support.md) for details.

## Terms

Use of System Alert Manager is subject to the applicable Atlassian Marketplace licence and the [Nuvriqo Terms of Use](terms.md).
