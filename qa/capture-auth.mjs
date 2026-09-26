import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const baseUrl = process.env.QA_BASE_URL;
if (!baseUrl) throw new Error('Set QA_BASE_URL to your Atlassian site URL first.');

const authFile = path.resolve(process.env.QA_STORAGE_STATE || 'qa/.auth/storageState.json');
fs.mkdirSync(path.dirname(authFile), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

const prompt = readline.createInterface({ input, output });
await prompt.question('Sign in to Atlassian in the browser, then press Enter here to save the demo session. ');
prompt.close();

await context.storageState({ path: authFile });
await browser.close();
console.log(`Saved authenticated browser state to ${authFile}`);
