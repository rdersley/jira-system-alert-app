import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const required = ['QA_BASE_URL', 'DEMO_ISSUE_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const baseUrl = process.env.QA_BASE_URL.replace(/\/$/, '');
const issueKey = process.env.DEMO_ISSUE_KEY;
const issueUrl = process.env.DEMO_ISSUE_URL || `${baseUrl}/browse/${encodeURIComponent(issueKey)}`;
const authFile = path.resolve(process.env.QA_STORAGE_STATE || 'qa/.auth/storageState.json');
const outputDir = path.resolve(process.env.DEMO_OUTPUT_DIR || 'qa/artifacts/system-alert-demo');
const allowSend = /^true$/i.test(process.env.DEMO_ALLOW_SEND || 'false');
const slowMotion = Number(process.env.DEMO_SLOW_MO || 250);

if (!fs.existsSync(authFile)) {
  throw new Error(`No authenticated browser state found at ${authFile}. Run npm run demo:auth first.`);
}
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: /^true$/i.test(process.env.DEMO_HEADLESS || 'false'),
  slowMo: Number.isFinite(slowMotion) ? slowMotion : 250
});
const context = await browser.newContext({
  storageState: authFile,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } }
});
const page = await context.newPage();

const pause = (ms = 1200) => page.waitForTimeout(ms);
const allRoots = () => [page, ...page.frames()];

async function findVisible(role, name, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const root of allRoots()) {
      const locator = root.getByRole(role, { name, exact: false }).first();
      try {
        if (await locator.isVisible({ timeout: 250 })) return locator;
      } catch {}
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Could not find visible ${role} matching ${String(name)}`);
}

async function findLabel(name, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const root of allRoots()) {
      const locator = root.getByLabel(name, { exact: false }).first();
      try {
        if (await locator.isVisible({ timeout: 250 })) return locator;
      } catch {}
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function highlight(locator, duration = 900) {
  await locator.evaluate((element) => {
    element.dataset.demoOutline = element.style.outline;
    element.dataset.demoOffset = element.style.outlineOffset;
    element.style.outline = '4px solid #0C66E4';
    element.style.outlineOffset = '3px';
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  await page.waitForTimeout(duration);
  await locator.evaluate((element) => {
    element.style.outline = element.dataset.demoOutline || '';
    element.style.outlineOffset = element.dataset.demoOffset || '';
    delete element.dataset.demoOutline;
    delete element.dataset.demoOffset;
  });
}

let video;
try {
  await page.goto(issueUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pause(5000);
  if (/id\.atlassian\.com|\/login/i.test(page.url())) {
    throw new Error('The saved Atlassian session has expired. Run npm run demo:auth again.');
  }

  const panelHeading = await findVisible('heading', /^System Alert$/i);
  await highlight(panelHeading, 1300);

  const openButton = await findVisible('button', /^Send System Alert$/i);
  await highlight(openButton);
  await openButton.click();
  await pause(2200);

  const formHeading = await findVisible('heading', /^Send System Alert$/i);
  await highlight(formHeading, 1000);

  const startTime = await findLabel(/Issue start time/i);
  if (startTime) await highlight(startTime, 650);
  const nextUpdate = await findLabel(/Next update due/i);
  if (nextUpdate) await highlight(nextUpdate, 650);

  const previewButton = await findVisible('button', /Preview Email/i);
  await highlight(previewButton);
  await previewButton.click();
  await pause(2400);

  const previewHeading = await findVisible('heading', /Email preview/i);
  await highlight(previewHeading, 1200);
  await pause(2200);

  const closePreview = await findVisible('button', /Close preview/i);
  await closePreview.click();
  await pause(900);

  const sendButton = await findVisible('button', /Send (System )?Alert/i);
  await highlight(sendButton, 1100);
  if (allowSend) {
    await sendButton.click();
    await findVisible('heading', /System Alert sent/i, 60000);
    await pause(2500);
  }

  await page.screenshot({ path: path.join(outputDir, 'final-frame.png'), fullPage: false });
  video = page.video();
} catch (error) {
  await page.screenshot({ path: path.join(outputDir, 'recording-failure.png'), fullPage: true }).catch(() => {});
  fs.writeFileSync(path.join(outputDir, 'recording-failure.txt'), error instanceof Error ? error.stack || error.message : String(error));
  throw error;
} finally {
  await context.close();
  if (video) await video.saveAs(path.join(outputDir, 'system-alert-manager-demo.webm'));
  await browser.close();
}

console.log(`System Alert demo recorded: ${path.join(outputDir, 'system-alert-manager-demo.webm')}`);
console.log(allowSend ? 'The configured test alert was sent.' : 'Preview-only safety mode: no email or SMS was sent.');
