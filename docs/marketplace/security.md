# System Alert Manager Security Policy

**Provider:** Nuvriqo  
**Product:** System Alert Manager for Jira Service Management  
**Last updated:** 21 August 2026

## Overview

Nuvriqo is committed to protecting customer and end-user data processed by System Alert Manager. System Alert Manager is an Atlassian Forge application for Jira Service Management and uses Atlassian-hosted Forge capabilities for application execution and app storage.

## Data handling

System Alert Manager may process information required to configure and deliver incident communications, including contact names, email addresses, mobile telephone numbers, client or organisation identifiers, and selected Jira issue information used in notification content.

Application configuration and app-managed data are stored using Atlassian Forge storage. System Alert Manager does not operate a separate Nuvriqo-hosted application database for this data.

When a customer configures and uses an external communication provider, information necessary to deliver a notification may be transmitted to that provider. Supported integrations may include:

- Microsoft 365 / Microsoft Graph for email delivery;
- SendGrid for email delivery; and
- Twilio for SMS delivery.

The data sent depends on the channel and customer configuration and may include recipient contact details and notification content. These providers process transmitted data according to their own services, contractual terms, privacy policies and security controls.

## Authentication and credentials

System Alert Manager does not require end users to provide their Atlassian account password or Atlassian Personal Access Token (PAT) to use the application.

Credentials or configuration values required for customer-selected external communication providers are handled through the application's administrative configuration and should only be managed by authorised administrators. Customers are responsible for protecting and appropriately rotating credentials for their third-party provider accounts.

## Access control

Access to System Alert Manager is governed by Atlassian and Jira permissions together with application configuration. Administrative functions are intended for authorised Jira administrators. Customers are responsible for maintaining appropriate Jira user, administrator and project permissions.

## Network communications

System Alert Manager communicates with Atlassian services and, when configured by the customer, approved external communication services over HTTPS. The Forge application declares the external backend services it requires in its Forge manifest.

## Data residency

System Alert Manager does not currently advertise independent data residency options. Atlassian-hosted application data is subject to the capabilities and terms of the Atlassian Forge platform. Data transmitted to customer-configured third-party communication providers may be processed in locations determined by those providers and the customer's provider configuration.

## Logging and monitoring

Operational logging is intended for application operation, troubleshooting and security. Nuvriqo aims to avoid intentionally placing unnecessary end-user personal data or provider secrets in application logs.

## Vulnerability management

Nuvriqo reviews security-relevant dependencies and application changes and aims to address confirmed vulnerabilities according to their severity and the risk to customers. Security-related fixes may be released outside the normal feature release cycle when appropriate.

## Security incidents

If Nuvriqo becomes aware of a security incident affecting System Alert Manager, we will investigate the issue, take reasonable steps to contain and remediate it, and communicate with affected customers where notification is appropriate or legally required.

## Customer responsibilities

Customers should:

- restrict application administration to authorised personnel;
- protect credentials for Microsoft, SendGrid, Twilio and other configured services;
- use appropriate recipient lists and avoid including unnecessary sensitive information in notification templates;
- maintain appropriate Jira and Atlassian access controls; and
- promptly report suspected security issues.

## Security contact

Security issues relating to System Alert Manager should be reported through Nuvriqo's published Marketplace support contact. Please include sufficient information to reproduce or investigate the issue and avoid including unnecessary sensitive data in the initial report.

## Related documents

- [System Alert Manager documentation](system-alert-manager.md)
- [Privacy Policy](privacy.md)
- [Support](support.md)
- [Terms](terms.md)

Nuvriqo may update this policy as System Alert Manager, its integrations, or applicable Marketplace requirements change.
