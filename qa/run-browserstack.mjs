import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const required = ['BROWSERSTACK_USERNAME', 'BROWSERSTACK_ACCESS_KEY', 'QA_BASE_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const artifacts = path.resolve('qa/artifacts');
fs.mkdirSync(artifacts, { recursive: true });

const baseUrl = process.env.QA_BASE_URL;
const requestedPath = process.env.QA_PATH || '/';
const targetUrl = /^https?:\/\//i.test(requestedPath)
  ? requestedPath
  : new URL(requestedPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
const authFile = path.resolve(process.env.QA_STORAGE_STATE || 'qa/.auth/storageState.json');
const clientVersion = execSync('npx playwright --version', { encoding: 'utf8' }).trim().split(' ').pop();

// Optional readiness check: text that must appear in the page or in any of its
// iframes (Forge Custom UI renders inside a cross-origin iframe), for example the
// app version shown once the admin page has finished loading its data.
const expectText = (process.env.QA_EXPECT_TEXT || '').trim();
const readyTimeoutMs = Number(process.env.QA_READY_TIMEOUT_MS || 60000);

const caps = {
  browser: process.env.QA_BROWSER || 'chrome',
  browser_version: process.env.QA_BROWSER_VERSION || 'latest',
  os: process.env.QA_OS || 'Windows',
  os_version: process.env.QA_OS_VERSION || '11',
  'browserstack.username': process.env.BROWSERSTACK_USERNAME,
  'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
  'client.playwrightVersion': clientVersion,
  project: process.env.BROWSERSTACK_PROJECT_NAME || 'Nuvriqo',
  build: process.env.BROWSERSTACK_BUILD_NAME || `nuvriqo-${Date.now()}`,
  name: process.env.QA_SESSION_NAME || 'Authenticated Jira smoke test',
  'browserstack.debug': true,
  'browserstack.networkLogs': true,
  'browserstack.console': 'info',
  'browserstack.video': true
};

const LOGGED_OUT_URL = /id\.atlassian\.com|\/login/i;

// Query strings can carry signed tokens, so evidence keeps only origin and path.
const safeUrl = value => {
  try { const u = new URL(value); return `${u.origin}${u.pathname}`; } catch { return String(value || '').split('?')[0]; }
};

async function frameTexts(page) {
  const out = [];
  for (const frame of page.frames()) {
    try {
      const text = (await frame.locator('body').innerText({ timeout: 2000 })).trim();
      out.push({ url: safeUrl(frame.url()), text });
    } catch {
      // Frames that are detached or still navigating are checked on the next poll.
    }
  }
  return out;
}

async function waitForExpectedText(page) {
  const deadline = Date.now() + readyTimeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    // Fail fast when the saved Jira session has expired instead of waiting out the timeout.
    if (LOGGED_OUT_URL.test(page.url())) {
      throw new Error(`Authentication state was not accepted; landed on ${safeUrl(page.url())}. Refresh the JIRA_STORAGE_STATE_GZIP_B64 secret.`);
    }
    last = await frameTexts(page);
    const match = last.find(f => f.text.includes(expectText));
    if (match) return match;
    await page.waitForTimeout(2000);
  }
  const seen = last
    .filter(f => f.text)
    .map(f => `  ${f.url}: ${f.text.replace(/\s+/g, ' ').slice(0, 200)}`)
    .join('\n');
  throw new Error(`Expected text "${expectText}" did not appear within ${readyTimeoutMs / 1000}s. Frames seen:\n${seen || '  (no readable frames)'}`);
}

let browser;
let page;
let status = 'failed';
let reason = 'Test did not complete';
const consoleErrors = [];
const failedResources = [];
const evidence = extra => ({ targetUrl, expectText: expectText || null, consoleErrors, failedResources, ...extra });

try {
  browser = await chromium.connect({
    wsEndpoint: `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`
  });
  const contextOptions = fs.existsSync(authFile) ? { storageState: authFile } : {};
  const context = await browser.newContext(contextOptions);
  page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const where = msg.location()?.url ? ` (${safeUrl(msg.location().url)})` : '';
    consoleErrors.push(`${msg.text()}${where}`);
  });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('response', res => {
    if (res.status() >= 400) failedResources.push({ status: res.status(), type: res.request().resourceType(), url: safeUrl(res.url()) });
  });
  page.on('requestfailed', req => {
    failedResources.push({ status: 'failed', type: req.resourceType(), url: safeUrl(req.url()), error: req.failure()?.errorText || '' });
  });

  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (response && response.status() >= 400) throw new Error(`Target returned HTTP ${response.status()}`);

  let matchedFrame = null;
  if (expectText) {
    const match = await waitForExpectedText(page);
    matchedFrame = match.url;
  } else {
    await page.waitForTimeout(4000);
  }

  const finalUrl = page.url();
  const title = await page.title();
  const bodyText = (await page.locator('body').innerText({ timeout: 15000 })).trim();
  const looksLoggedOut = LOGGED_OUT_URL.test(finalUrl) || /log in to continue|sign in to continue/i.test(bodyText);

  if (looksLoggedOut) throw new Error(`Authentication state was not accepted; landed on ${safeUrl(finalUrl)}`);
  if (!bodyText) throw new Error('Loaded page has an empty body');

  await page.screenshot({ path: path.join(artifacts, 'browserstack-smoke.png'), fullPage: true });
  fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify(evidence({ finalUrl: safeUrl(finalUrl), title, matchedFrame }), null, 2));
  console.log(`BrowserStack smoke passed: ${title} — ${safeUrl(finalUrl)}`);
  if (expectText) console.log(`Found "${expectText}" in ${matchedFrame}`);
  if (consoleErrors.length) console.log(`Captured ${consoleErrors.length} console/page errors:\n${consoleErrors.map(e => `  ${e}`).join('\n')}`);
  if (failedResources.length) console.log(`Captured ${failedResources.length} failed resources:\n${failedResources.map(r => `  ${r.status} ${r.type} ${r.url}`).join('\n')}`);

  status = 'passed';
  reason = expectText ? `Found "${expectText}" on ${title || safeUrl(finalUrl)}` : `Loaded authenticated Jira page: ${title || safeUrl(finalUrl)}`;
} catch (error) {
  reason = error instanceof Error ? error.message : String(error);
  if (page) {
    try { await page.screenshot({ path: path.join(artifacts, 'browserstack-failure.png'), fullPage: true }); } catch {}
  }
  fs.writeFileSync(path.join(artifacts, 'failure.txt'), reason);
  fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify(evidence({ error: reason }), null, 2));
  throw error;
} finally {
  if (page) {
    try {
      await page.evaluate(`browserstack_executor: ${JSON.stringify({ action: 'setSessionStatus', arguments: { status, reason: reason.slice(0, 250) } })}`);
    } catch {}
  }
  if (browser) await browser.close();
}
