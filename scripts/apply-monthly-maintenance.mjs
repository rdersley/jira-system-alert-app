import { readFile, writeFile } from 'node:fs/promises';

async function read(path) { return await readFile(path, 'utf8'); }
async function write(path, value) { await writeFile(path, value, 'utf8'); }
function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(search, replacement);
}

let index = await read('src/index.js');
if (!index.includes("from './monthly-schedule.mjs'")) {
  index = replaceOnce(index,
    "import { kvs } from '@forge/kvs';\n",
    "import { kvs } from '@forge/kvs';\nimport { scheduleState } from './monthly-schedule.mjs';\n",
    'monthly schedule import');
}
if (!index.includes('SCHEDULER_STATUS_KEY')) {
  index = replaceOnce(index,
    "const AUTO_TEST_PREFIX = 'system-alert:auto-test:';\n",
    "const AUTO_TEST_PREFIX = 'system-alert:auto-test:';\nconst SCHEDULER_STATUS_KEY = 'system-alert:monthly-scheduler-status';\n",
    'scheduler status key');
}

const oldAdminLoop = `  const autoTestClients = [];
  for (const clientCode of monthlyClients) {
    const history = (await kvs.get(\`system-alert:test-history:\${clientCode}\`)) || [];
    autoTestClients.push({ clientCode, last: Array.isArray(history) && history.length ? history[history.length - 1] : null });
  }
`;
const newAdminLoop = `  const autoTestClients = [];
  for (const clientCode of monthlyClients) {
    const history = (await kvs.get(\`system-alert:test-history:\${clientCode}\`)) || [];
    const eligible = contactsRaw.filter(c => c.active !== false && c.monthlyTestAlerts && normalizeTextValue(c.clientCode).toUpperCase() === clientCode);
    const emailCount = new Set(eligible.filter(c => c.emailAlerts === true && normalizeTextValue(c.email)).map(c => normalizeTextValue(c.email).toLowerCase())).size;
    const smsCount = new Set(eligible.filter(c => c.smsAlerts === true && normalizeTextValue(c.mobile)).map(c => normalizeTextValue(c.mobile))).size;
    autoTestClients.push({
      clientCode,
      last: Array.isArray(history) && history.length ? history[0] : null,
      contactCount: eligible.length,
      emailCount,
      smsCount
    });
  }
  const schedulerStatus = (await kvs.get(SCHEDULER_STATUS_KEY)) || {};
`;
if (!index.includes('const schedulerStatus = (await kvs.get(SCHEDULER_STATUS_KEY))')) {
  index = replaceOnce(index, oldAdminLoop, newAdminLoop, 'monthly admin status loop');
}
index = replaceOnce(index,
  "    autoTestStatus: { enabled: settings.monthlyTestEnabled !== false, hour: Number(settings.monthlyTestHour ?? 10), clients: autoTestClients }\n",
  "    autoTestStatus: { enabled: settings.monthlyTestEnabled !== false, hour: Number(settings.monthlyTestHour ?? 10), clients: autoTestClients, scheduler: schedulerStatus }\n",
  'admin scheduler status response');

const schedulerStart = index.indexOf('export async function monthlyTestScheduler() {');
const handlerMarker = '\n\nexport const handler = resolver.getDefinitions();';
const schedulerEnd = index.indexOf(handlerMarker, schedulerStart);
if (schedulerStart < 0 || schedulerEnd < 0) throw new Error('Monthly scheduler block not found.');
const replacement = `async function monthlyTestContacts(clientCode) {
  const code = normalizeTextValue(clientCode).toUpperCase();
  const all = (await getAllContacts()).map(c => ({
    ...c,
    clientCode: normalizeTextValue(c.clientCode).toUpperCase(),
    clientName: normalizeTextValue(c.clientName),
    name: normalizeTextValue(c.name),
    email: normalizeTextValue(c.email),
    mobile: normalizeTextValue(c.mobile),
    emailAlerts: c.emailAlerts === true,
    smsAlerts: c.smsAlerts === true,
    monthlyTestAlerts: c.monthlyTestAlerts === true,
    active: c.active !== false
  }));
  return all.filter(c => c.active && c.monthlyTestAlerts && c.clientCode === code);
}

async function deliverMonthlyTest(clientCode, { automatic = false, now = new Date() } = {}) {
  const settings = await getSettings();
  const code = normalizeTextValue(clientCode).toUpperCase();
  if (!code) throw new Error('Choose a client for the monthly test.');
  const clientContacts = await monthlyTestContacts(code);
  if (!clientContacts.length) throw new Error('No contacts are enabled for Monthly Test alerts for this client.');

  const emailRecipients = [...new Set(clientContacts.filter(c => c.emailAlerts && c.email).map(c => c.email))];
  const smsRecipients = [...new Set(clientContacts.filter(c => c.smsAlerts && c.mobile).map(c => c.mobile))];
  if (!emailRecipients.length && !smsRecipients.length) throw new Error('No enabled email or SMS destinations are configured for this client.');

  const label = monthLabel(now);
  const a = {
    issueKey: '', clientCode: code, priority: '', alertType: 'monthly-test',
    summary: 'Monthly System Alert Test', message: automatic
      ? \`This is the scheduled monthly System Alert test for \${code}.\`
      : \`This is a manual monthly System Alert diagnostic test for \${code}.\`,
    startTime: '', nextUpdate: '', testMonth: label, fromName: settings.fromName
  };
  const templates = await getTemplates();
  const branding = await getBranding();
  const subject = buildEmailSubject(a, templates);
  const text = buildEmailText(a, templates);
  const html = buildEmailHtml(a, templates, branding);

  let emailOk = false;
  if (emailRecipients.length) {
    await sendEmail(emailRecipients, subject, html, text, settings.fromName, settings.replyToEmail, branding);
    emailOk = true;
  }
  const smsText = buildSmsText(a, templates);
  let smsSent = 0;
  const smsFailed = [];
  for (const mobile of smsRecipients) {
    try { await sendTwilio(mobile, smsText); smsSent++; }
    catch (e) { smsFailed.push({ mobile: maskPhone(mobile), error: e.message }); }
  }

  const entry = {
    at: new Date().toISOString(), automatic, manual: !automatic, alertType: 'monthly-test',
    clientCode: code, emailCount: emailRecipients.length, emailOk,
    smsCount: smsSent, smsFailedCount: smsFailed.length,
    monthKey: monthKey(now), monthLabel: label
  };
  const historyKey = \`system-alert:test-history:\${code}\`;
  const history = (await kvs.get(historyKey)) || [];
  await kvs.set(historyKey, [entry, ...history].slice(0, 36));
  return { clientCode: code, sent: true, automatic, emailCount: emailRecipients.length, smsCount: smsSent, smsFailedCount: smsFailed.length, at: entry.at, monthKey: entry.monthKey, monthLabel: label };
}

resolver.define('runMonthlyTestNow', async ({ payload }) => {
  return await deliverMonthlyTest(payload?.clientCode, { automatic: false, now: new Date() });
});

export async function monthlyTestScheduler() {
  const settings = await getSettings();
  const now = new Date();
  const targetHour = Number(settings.monthlyTestHour ?? 10);
  const schedule = scheduleState(now, targetHour);
  const statusBase = {
    checkedAt: now.toISOString(),
    timeZone: schedule.timeZone,
    targetHour: schedule.targetHour,
    local: schedule.local
  };

  if (settings.monthlyTestEnabled === false) {
    const status = { ...statusBase, outcome: 'skipped', reason: 'Automatic monthly test is disabled.' };
    await kvs.set(SCHEDULER_STATUS_KEY, status);
    return { skipped: status.reason };
  }
  if (!schedule.due) {
    const status = { ...statusBase, outcome: 'skipped', reason: schedule.reason };
    await kvs.set(SCHEDULER_STATUS_KEY, status);
    return { skipped: status.reason };
  }

  const all = (await getAllContacts()).map(c => ({
    ...c,
    clientCode: normalizeTextValue(c.clientCode).toUpperCase(),
    monthlyTestAlerts: c.monthlyTestAlerts === true,
    active: c.active !== false
  }));
  const clients = [...new Set(all.filter(c => c.active && c.monthlyTestAlerts && c.clientCode).map(c => c.clientCode))].sort();
  const month = monthKey(now);
  const label = monthLabel(now);
  const results = [];

  for (const clientCode of clients) {
    const markerKey = \`\${AUTO_TEST_PREFIX}\${clientCode}:\${month}\`;
    const marker = await kvs.get(markerKey);
    const runningAgeMs = marker?.status === 'running' && marker?.at ? (now.getTime() - new Date(marker.at).getTime()) : 0;
    if (marker?.status === 'sent' || (marker?.status === 'running' && runningAgeMs < 2 * 60 * 60 * 1000)) {
      results.push({ clientCode, skipped: 'Already processed this month.' });
      continue;
    }

    await kvs.set(markerKey, { status: 'running', at: now.toISOString() });
    try {
      const sent = await deliverMonthlyTest(clientCode, { automatic: true, now });
      await kvs.set(markerKey, { status: 'sent', at: sent.at, emailCount: sent.emailCount, smsCount: sent.smsCount, smsFailedCount: sent.smsFailedCount });
      results.push(sent);
    } catch (e) {
      await kvs.set(markerKey, { status: 'failed', at: new Date().toISOString(), error: e.message });
      results.push({ clientCode, error: e.message });
    }
  }

  const failed = results.filter(r => r.error).length;
  const sent = results.filter(r => r.sent).length;
  const outcome = failed ? (sent ? 'partial-failure' : 'failed') : (sent ? 'sent' : 'skipped');
  const reason = failed
    ? \`\${failed} client(s) failed; \${sent} client(s) sent.\`
    : sent
      ? \`Monthly test sent for \${sent} client(s).\`
      : 'No eligible client required a send on this check.';
  await kvs.set(SCHEDULER_STATUS_KEY, { ...statusBase, outcome, reason, results: results.slice(0, 50) });
  return { monthKey: month, monthLabel: label, results };
}`;
index = index.slice(0, schedulerStart) + replacement + index.slice(schedulerEnd);
await write('src/index.js', index);

let secure = await read('src/secure-index.js');
if (!secure.includes("  'runMonthlyTestNow',")) {
  secure = replaceOnce(secure,
    "  'testContact',\n  'deleteContact'\n",
    "  'testContact',\n  'runMonthlyTestNow',\n  'deleteContact'\n",
    'admin resolver allowlist');
  secure = replaceOnce(secure,
    "  'sendAlert',\n  'testEmailProvider',\n  'testContact'\n",
    "  'sendAlert',\n  'testEmailProvider',\n  'testContact',\n  'runMonthlyTestNow'\n",
    'delivery resolver licence allowlist');
  secure = replaceOnce(secure,
    "    case 'testContact':\n    case 'deleteContact':\n",
    "    case 'runMonthlyTestNow':\n      assertLength(payload.clientCode, 100, 'Client code');\n      if (!text(payload.clientCode)) throw new Error('Choose a client for the monthly test.');\n      break;\n    case 'testContact':\n    case 'deleteContact':\n",
    'manual monthly resolver validation');
}
await write('src/secure-index.js', secure);

let entry = await read('static/admin/src/entry.js');
if (!entry.includes("import './monthly-test-tools.js';")) {
  entry = replaceOnce(entry, "import './contact-multiclient.js';\n", "import './contact-multiclient.js';\nimport './monthly-test-tools.js';\n", 'monthly admin tools entry import');
  await write('static/admin/src/entry.js', entry);
}

let contacts = await read('static/admin/src/contact-multiclient.js');
contacts = contacts.replace("'\\\"':'&quot'", "'\\\"':'&quot;'");
await write('static/admin/src/contact-multiclient.js', contacts);

await write('VERSION', '3.10.1\n');
console.log('Applied System Alert Manager 3.10.1 monthly-test reliability maintenance patch.');
