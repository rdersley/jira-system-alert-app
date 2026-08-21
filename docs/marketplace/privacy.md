# System Alert Manager — Privacy and Data Handling

Last updated: 21 August 2026

This page explains how Nuvriqo System Alert Manager handles information when used with Jira Service Management.

## Data stored by the app

System Alert Manager stores application configuration in Atlassian Forge storage. Depending on customer configuration, this can include:

- client-specific contact or distribution-list names;
- email addresses;
- mobile telephone numbers;
- configured Jira project, field and priority mappings;
- notification templates and branding settings;
- provider configuration metadata;
- communication and scheduled-test history required for the app's operation.

Provider secrets such as SendGrid, Twilio or Microsoft 365 credentials entered through the app are stored using Forge encrypted secret storage and are not displayed back to administrators after saving.

## Why the data is used

The data is used only to provide System Alert Manager functionality, including selecting the correct recipients, rendering incident messages, sending email or SMS notifications, running configured communication tests, and showing relevant communication history.

## Third-party services

System Alert Manager can communicate with third-party providers chosen and configured by the customer:

- **SendGrid** for email delivery;
- **Microsoft 365 / Microsoft Graph** for email delivery;
- **Twilio** for SMS delivery.

When a customer uses one of these providers, the information required to deliver the selected notification is transmitted to that provider under the customer's relationship with that provider.

## Access, correction and deletion

Jira administrators can manage and delete configured System Alert Manager contacts and settings through the app's administration interface. Customers can contact Nuvriqo for assistance with access, correction or deletion questions at **support@nuvriqo.com**.

## Atlassian

System Alert Manager is a Forge app that operates within Atlassian Cloud. Atlassian's own privacy, security and data-processing terms apply separately to Atlassian services used by the customer.

## Contact

Privacy or data-handling questions relating to System Alert Manager can be sent to **support@nuvriqo.com**.
