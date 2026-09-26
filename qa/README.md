# BrowserStack UI QA

`run-browserstack.mjs` opens a Jira page on BrowserStack using a saved Jira login. It is run by the **BrowserStack UI QA** workflow (Actions → BrowserStack UI QA → Run workflow).

## Workflow inputs

| Input | Meaning |
|---|---|
| `path` | Jira path or full URL, relative to the `JIRA_BASE_URL` secret. |
| `browser` | `chrome` or `edge`. |
| `expect_text` | Optional. The run waits up to 60 s for this text to appear in the page or any iframe, which covers Forge Custom UI. `VERSION` means `v` plus the repo `VERSION` file. Leave it blank to check only that the page loads while signed in. |

To confirm a deployed build of the admin page, use:

- `path`: `/jira/settings/apps/8c53b866-0bd4-46bf-ab53-f3de18378d6b/<environment id>`
- `expect_text`: `VERSION`

`forge environments list` shows the environment IDs.

Each run uploads `result.json` and a screenshot. `result.json` lists console errors and failed resources, with query strings removed.

When starting the workflow with `gh` from Git Bash, set `MSYS_NO_PATHCONV=1`. Otherwise Git Bash turns a `path` that starts with `/` into a local Windows path.

## Refreshing the saved Jira login

If a run fails with *Authentication state was not accepted*, the saved session has expired. Capture a new one and update the secret:

```bash
cd qa && npm install && npx playwright install chromium && cd ..
QA_BASE_URL=https://nuvriqo.atlassian.net node qa/capture-auth.mjs
```

A browser opens. Sign in to the QA account there, then press Enter in the terminal. The session is saved to `qa/.auth/storageState.json`, which git ignores. Then upload it and delete the local copy:

```bash
node -e "process.stdout.write(require('zlib').gzipSync(require('fs').readFileSync('qa/.auth/storageState.json')).toString('base64'))" | gh secret set JIRA_STORAGE_STATE_GZIP_B64 --repo rdersley/jira-system-alert-app
```

```bash
rm qa/.auth/storageState.json
```

The saved file is a live Jira session, so never commit it or share it.
