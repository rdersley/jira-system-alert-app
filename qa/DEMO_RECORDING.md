# System Alert Manager demo recording

This Playwright script records the live Jira workflow at 1440 × 900 and saves a reusable video under `qa/artifacts/system-alert-demo`.

## First-time setup

Install the QA dependency:

```bash
cd qa
npm ci
cd ..
```

Save an authenticated Atlassian browser session. Complete any MFA in the browser that opens:

```bash
QA_BASE_URL=https://your-site.atlassian.net npm run demo:auth
```

`qa/.auth` is ignored by Git and must never be committed because it contains authenticated session data.

## Record the demonstration

Choose a safe P1 or P2 demonstration ticket that contains no customer-sensitive information:

```bash
QA_BASE_URL=https://your-site.atlassian.net \
DEMO_ISSUE_KEY=TEST-123 \
npm run demo:system-alert
```

The default recording is deliberately preview-only. It demonstrates the issue panel, alert form, incident timing fields, email preview and final Send Alert control without sending email or SMS.

Only enable a real send when every selected recipient is an approved test contact:

```bash
QA_BASE_URL=https://your-site.atlassian.net \
DEMO_ISSUE_KEY=TEST-123 \
DEMO_ALLOW_SEND=true \
npm run demo:system-alert
```

Optional settings:

- `DEMO_ISSUE_URL`: overrides the standard `/browse/ISSUE-KEY` URL.
- `DEMO_OUTPUT_DIR`: changes the artifact directory.
- `DEMO_SLOW_MO`: changes the delay applied to browser actions; default `250` milliseconds.
- `DEMO_HEADLESS=true`: records without displaying the browser.
- `QA_STORAGE_STATE`: uses a different saved authentication-state file.

The output is `system-alert-manager-demo.webm`. It can be converted to MP4 for Marketplace or website use with FFmpeg:

```bash
ffmpeg -i qa/artifacts/system-alert-demo/system-alert-manager-demo.webm \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  qa/artifacts/system-alert-demo/system-alert-manager-demo.mp4
```
