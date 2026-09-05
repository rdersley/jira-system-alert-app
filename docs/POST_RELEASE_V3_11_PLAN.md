# System Alert Manager — Post-release v3.11 plan

Baseline: production/release line 3.10.2 at `36f6da047d14df3571af27c234920774e04b67ab`.

## Release isolation

The submitted/released production line remains frozen. All post-release work starts on `post-release/system-alert-v3.11`. Do not merge into `master`, deploy to production, or change Marketplace release metadata until the v3.11 release gates are green.

## Product theme

**Scheduling + Diagnostics + Admin UX**

The goal is to make System Alert Manager easier to trust, configure and prove before a real P1/P2 incident, without expanding the core alert engine unnecessarily.

## P0 — Fully configurable Monthly Test

Replace fixed monthly scheduling assumptions with an administrator-controlled schedule.

Required configuration:
- enable/disable scheduled test
- test client/recipient group
- channel selection consistent with supported test behaviour
- schedule mode supporting week-of-month + weekday and day-of-month where practical
- selectable weekday
- selectable occurrence (first/second/third/fourth/last)
- local execution time
- IANA timezone
- clear schedule summary before save

Required status:
- next scheduled test
- last attempted test
- last successful test
- last failed test
- last failure reason (sanitised)
- Send test now remains separate from the scheduled cadence

Safety:
- manual tests must be clearly labelled TEST
- test action must not mutate a real incident lifecycle
- validate recipient/config readiness before send
- avoid duplicate execution when scheduled functions overlap/retry
- calculate due state from timezone-aware configuration

## P0 — Setup & Diagnostics

Add an administrator-facing readiness view with explicit checks:
- Email provider configured
- SMS provider configured
- client/contact configuration present
- templates ready
- required Jira field mappings ready
- monthly-test schedule valid
- scheduler heartbeat/last run visible

Overall state:
- `Ready for Alerts`
- `Needs attention`

Actions:
- Test Email
- Test SMS
- Send Monthly Test Now
- re-run diagnostics

Diagnostics must provide actionable, non-secret error messages. Never render provider credentials/tokens.

## P1 — Admin UI polish

Restructure configuration around a small number of task-oriented sections:
1. Setup status
2. Communication providers
3. Clients & recipients
4. Alert templates
5. Jira field mapping
6. Monthly Test
7. Diagnostics

UX requirements:
- consistent cards/section headings
- concise helper text
- inline validation
- clear dirty/saved/saving/error states
- useful empty states
- destructive/high-impact actions visually separated
- searchable client selector retained
- first-run setup checklist
- responsive layout suitable for normal Jira project/admin widths

## P1 — Jira field mappings

Make these administrator-configurable rather than hard-coded assumptions:
- Issue start time
- Next update due

Requirements:
- field picker from eligible Jira fields
- current mapping shown clearly
- unmapped state supported
- validation before save
- diagnostics surface missing/invalid mappings

## P1 — Template preview & safe testing

- preview should closely match delivered Microsoft 365 email structure
- make available variables/placeholders discoverable
- safe default templates
- test/preview controls visually distinct from live alert actions
- preview recipient/context should use synthetic/test labelling where possible

## P2 — Operational history

After v3.11 core is stable, consider a lightweight test/diagnostic history:
- timestamp
- test type
- client/config context
- channel
- success/failure
- sanitised error summary

Do not turn v3.11 into a full analytics/audit product.

## Marketplace lessons applied

- screenshots should show the actual in-product workflow and setup confidence
- listing copy should lead with outcomes rather than feature inventory
- trust/security information should remain explicit about Forge hosting and external providers
- dependency/security scanning remains a release gate
- no customer/Ryanair data or branding in public assets

No material Atlassian reviewer-requested product defect is currently recorded; improvements above are product-quality/commercial improvements rather than remediation of reviewer rejection feedback.

## Acceptance gates

### Monthly Test
- deterministic schedule calculation unit tests
- DST/timezone boundary tests
- first/second/third/fourth/last weekday cases
- day-of-month edge cases if supported
- disabled schedule never sends
- retry/duplicate guard test
- manual Send test now does not alter schedule incorrectly

### Diagnostics
- every readiness check has green/amber/red semantics
- provider secrets never returned to frontend
- missing configuration produces actionable guidance
- test actions are authenticated/admin guarded

### UI
- automated browser smoke test for admin page
- setup state, Monthly Test editor, diagnostics and save states covered
- no regression to live issue alert action

### Release
- tests green
- Forge lint green
- dependency/security gate green
- development deployment only
- Jira installation upgrade green
- authenticated browser QA green
- documentation/screenshots updated
- production deploy requires explicit release decision after evidence review
