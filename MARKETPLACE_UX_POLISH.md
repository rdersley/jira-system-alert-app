# Marketplace UX polish

Final pre-submission cosmetic pass identified during Nuvriqo staging acceptance testing:

- Keep generic `Service Desk`, `P1`, `P2`, and priority colour starter defaults.
- Keep Reply-to email empty on a fresh installation and show `servicedesk@example.com` only as placeholder guidance.
- Keep SendGrid From/Reply-to example addresses as placeholders only; do not persist example addresses as configuration.
- When publisher Microsoft Easy Connect credentials are unavailable, default the Microsoft 365 sub-mode to Enterprise manual and present Easy Connect as unavailable rather than selected.
- Replace developer-oriented Easy Connect warning copy with customer-facing wording directing administrators to SendGrid or Microsoft 365 Enterprise manual setup.
- Make the SMS/Twilio configuration section visually explicit with an `SMS · Twilio` heading.
- Keep contact example name/email/mobile values as placeholders only.
- Do not change the current first-Wednesday monthly-test scheduler in this release; fully configurable scheduling is deferred to a post-Marketplace release.
