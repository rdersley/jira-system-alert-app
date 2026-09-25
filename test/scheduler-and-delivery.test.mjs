// Behaviour tests that execute the real backend (src/index.js) against in-memory
// fakes of Forge KVS, the Jira REST API and the SendGrid/Twilio HTTP endpoints.
// Run with --experimental-test-module-mocks (see package.json "test").
import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
const secrets = new Map();
const calls = [];
const outage = { email: false, sms: false };
const jiraComments = [];

const kvs = {
  get: async key => structuredClone(store.get(key)),
  set: async (key, value) => { store.set(key, structuredClone(value)); },
  delete: async key => { store.delete(key); },
  getSecret: async key => structuredClone(secrets.get(key)),
  setSecret: async (key, value) => { secrets.set(key, structuredClone(value)); },
  deleteSecret: async key => { secrets.delete(key); }
};

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  json: async () => body
});

const ISSUE = {
  key: 'SD-1',
  fields: {
    project: { key: 'SD' },
    priority: { name: 'P1' },
    summary: 'Payments down',
    customfield_client: { id: '10', value: 'ACME - Acme Ltd' }
  }
};

const jira = mode => ({
  requestJira: async (path, init = {}) => {
    if (mode === 'app' && path.includes('/comment')) {
      jiraComments.push(JSON.parse(init.body).body);
      return response(201, {});
    }
    if (path.startsWith('/rest/api/3/issue/SD-1')) return response(200, ISSUE);
    if (path.includes('/rest/forge/1/app/properties/')) return response(200, {});
    return response(404, 'not mocked');
  }
});

const fetch = async (url, init = {}) => {
  const host = new URL(url).host;
  calls.push({ host, url, body: init.body });
  if (host === 'api.sendgrid.com') return outage.email ? response(503, 'SendGrid unavailable') : response(202, '');
  if (host.endsWith('twilio.com')) return outage.sms ? response(500, 'Twilio unavailable') : response(201, { sid: 'SM1', status: 'queued' });
  return response(404, 'not mocked');
};

class Resolver {
  constructor() { this.defs = {}; }
  define(key, fn) { this.defs[key] = fn; }
  getDefinitions() { return this.defs; }
}

mock.module('@forge/kvs', { namedExports: { kvs } });
mock.module('@forge/resolver', { defaultExport: Resolver });
mock.module('@forge/api', {
  defaultExport: { asUser: () => jira('user'), asApp: () => jira('app') },
  namedExports: { fetch, route: (strings, ...values) => strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '') }
});

const app = await import('../src/index.js');
const defs = app.handler;

// First Wednesday of October 2026 is the 7th; Ireland is on IST (UTC+1), so
// 09:00Z is 10:00 local — the default monthly test hour.
const FIRST_WED_10AM = new Date('2026-10-07T09:00:00Z');
const FIRST_WED_9AM = new Date('2026-10-07T08:00:00Z');
const SECOND_WED_10AM = new Date('2026-10-14T09:00:00Z');

const contact = (id, overrides = {}) => ({
  id, clientOptionId: '10', clientValue: 'ACME - Acme Ltd', clientCode: 'ACME', clientName: 'Acme Ltd',
  name: `Contact ${id}`, email: `${id}@acme.test`, mobile: '+353871234567',
  priorities: ['P1'], emailAlerts: true, smsAlerts: true, monthlyTestAlerts: true, active: true,
  ...overrides
});

function seed(contacts) {
  store.set('system-alert:settings', {
    allowedProjectKey: 'SD', clientFieldId: 'customfield_client',
    priorityConfigs: [{ name: 'P1', label: 'P1', color: '#AE2E24' }],
    monthlyTestEnabled: true, monthlyTestHour: 10
  });
  store.set('system-alert:providers', { emailProvider: 'sendgrid', sendgridFromEmail: 'alerts@desk.test', twilioFromNumber: '+353861111111' });
  secrets.set('system-alert:provider:sendgrid-api-key', 'SG.test');
  secrets.set('system-alert:provider:twilio-account-sid', 'AC123');
  secrets.set('system-alert:provider:twilio-auth-token', 'token');
  store.set('system-alert:contacts:index', contacts.map(c => c.id));
  for (const c of contacts) secrets.set(`system-alert:contact:${c.id}`, c);
}

const at = date => mock.timers.enable({ apis: ['Date'], now: date });
const emails = () => calls.filter(c => c.host === 'api.sendgrid.com').flatMap(c => JSON.parse(c.body).personalizations.map(p => p.to[0].email));
const sms = () => calls.filter(c => c.host.endsWith('twilio.com'));
const marker = client => store.get(`system-alert:auto-test:${client}:2026-10`);
const schedulerStatus = () => store.get('system-alert:monthly-scheduler-status');

beforeEach(() => {
  store.clear(); secrets.clear(); calls.length = 0; jiraComments.length = 0;
  outage.email = false; outage.sms = false;
  delete process.env.SYSTEM_ALERT_MOCK_PROVIDERS;
});
afterEach(() => mock.timers.reset());

// ---- Monthly test scheduler -------------------------------------------------

test('scheduler: does nothing outside the first-Wednesday window', async () => {
  seed([contact('a')]);
  for (const date of [FIRST_WED_9AM, SECOND_WED_10AM]) {
    at(date);
    const result = await app.monthlyTestScheduler();
    assert.match(result.skipped, /Waiting until 10:00|Not the first Wednesday/);
    mock.timers.reset();
  }
  assert.equal(calls.length, 0);
  assert.equal(schedulerStatus().outcome, 'skipped');
});

test('scheduler: does nothing when the automatic monthly test is disabled', async () => {
  seed([contact('a')]);
  store.set('system-alert:settings', { ...store.get('system-alert:settings'), monthlyTestEnabled: false });
  at(FIRST_WED_10AM);
  const result = await app.monthlyTestScheduler();
  assert.equal(result.skipped, 'Automatic monthly test is disabled.');
  assert.equal(calls.length, 0);
});

test('scheduler: sends once per client to opted-in, active contacts only', async () => {
  seed([
    contact('a'),
    contact('b', { monthlyTestAlerts: false }),
    contact('c', { active: false }),
    contact('d', { clientOptionId: '20', clientCode: 'BETA', email: 'd@beta.test', mobile: '+353879999999' })
  ]);
  at(FIRST_WED_10AM);
  const result = await app.monthlyTestScheduler();

  assert.deepEqual(result.results.map(r => [r.clientCode, r.sent]), [['ACME', true], ['BETA', true]]);
  assert.deepEqual(emails().sort(), ['a@acme.test', 'd@beta.test']);
  // One SendGrid call per client keeps each client's recipients apart.
  assert.equal(calls.filter(c => c.host === 'api.sendgrid.com').length, 2);
  assert.equal(sms().length, 2);
  assert.equal(marker('ACME').status, 'sent');
  assert.equal(store.get('system-alert:test-history:ACME')[0].automatic, true);
  assert.equal(schedulerStatus().outcome, 'sent');
});

test('scheduler: later checks in the same window never resend', async () => {
  seed([contact('a')]);
  at(FIRST_WED_10AM);
  await app.monthlyTestScheduler();
  const sentCalls = calls.length;
  mock.timers.reset();

  at(new Date(FIRST_WED_10AM.getTime() + 5 * 60 * 1000));
  const again = await app.monthlyTestScheduler();
  assert.equal(calls.length, sentCalls);
  assert.equal(again.results[0].skipped, 'Already processed this month.');
});

test('scheduler: an email outage still delivers SMS and is not retried', async () => {
  seed([contact('a')]);
  outage.email = true;
  at(FIRST_WED_10AM);
  const result = await app.monthlyTestScheduler();

  assert.equal(result.results[0].sent, true);
  assert.equal(result.results[0].emailFailed, true);
  assert.equal(sms().length, 1);
  assert.equal(marker('ACME').status, 'sent');
  assert.equal(marker('ACME').emailFailed, true);
  assert.equal(schedulerStatus().outcome, 'partial-failure');
  const history = store.get('system-alert:test-history:ACME')[0];
  assert.equal(history.emailOk, false);
  assert.equal(history.emailCount, 0);

  // The SMS already reached the contact, so a later check must not send it again.
  mock.timers.reset();
  at(new Date(FIRST_WED_10AM.getTime() + 5 * 60 * 1000));
  await app.monthlyTestScheduler();
  assert.equal(sms().length, 1);
});

test('scheduler: a total outage is marked failed and retried on the next check', async () => {
  seed([contact('a')]);
  outage.email = true; outage.sms = true;
  at(FIRST_WED_10AM);
  const first = await app.monthlyTestScheduler();
  assert.match(first.results[0].error, /Nothing was sent/);
  assert.equal(marker('ACME').status, 'failed');
  assert.equal(schedulerStatus().outcome, 'failed');
  assert.equal(store.get('system-alert:test-history:ACME'), undefined);

  outage.email = false; outage.sms = false;
  mock.timers.reset();
  at(new Date(FIRST_WED_10AM.getTime() + 5 * 60 * 1000));
  const retry = await app.monthlyTestScheduler();
  assert.equal(retry.results[0].sent, true);
  assert.equal(marker('ACME').status, 'sent');
});

// ---- Live alert delivery ----------------------------------------------------

const alertPayload = ids => ({ issueKey: 'SD-1', clientCode: 'ACME', alertType: 'initial', contactIds: ids, sendEmail: true, sendSms: true, message: 'Investigating' });

test('sendAlert: an email outage does not stop SMS delivery', async () => {
  seed([contact('a'), contact('b', { mobile: '+353872222222' })]);
  outage.email = true;
  const result = await defs.sendAlert({ payload: alertPayload(['a', 'b']), context: { accountId: 'agent-1' } });

  assert.equal(result.email.ok, false);
  assert.match(result.email.error, /Email send failed \(503\)/);
  assert.equal(result.sms.sent, 2);
  assert.match(jiraComments[0], /Email: 0 recipient\(s\) \| SMS: 2 recipient\(s\).*FAILED: Email failed/);
  const entry = store.get('system-alert:history:SD-1')[0];
  assert.equal(entry.emailCount, 0);
  assert.equal(entry.emailFailed, true);
});

test('sendAlert: an SMS outage does not stop email delivery', async () => {
  seed([contact('a')]);
  outage.sms = true;
  const result = await defs.sendAlert({ payload: alertPayload(['a']), context: { accountId: 'agent-1' } });
  assert.equal(result.email.ok, true);
  assert.deepEqual(emails(), ['a@acme.test']);
  assert.equal(result.sms.failed.length, 1);
  assert.match(jiraComments[0], /Email: 1 recipient\(s\).*FAILED: 1 of 1 SMS failed/);
});

test('sendAlert: fails loudly and records nothing when no channel delivers', async () => {
  seed([contact('a')]);
  outage.email = true; outage.sms = true;
  await assert.rejects(
    defs.sendAlert({ payload: alertPayload(['a']), context: { accountId: 'agent-1' } }),
    /Nothing was sent\. Email failed.*1 of 1 SMS failed/
  );
  assert.equal(store.get('system-alert:history:SD-1'), undefined);
  assert.equal(jiraComments.length, 0);
});

// ---- Twilio region ----------------------------------------------------------

test('Twilio Ireland (IE1) region is saved and used for SMS delivery', async () => {
  seed([contact('a')]);
  const saved = await defs.saveProviderSettings({ payload: { ...store.get('system-alert:providers'), twilioRegion: 'ie1' } });
  assert.equal(saved.settings.twilioRegion, 'ie1');

  await defs.sendAlert({ payload: { ...alertPayload(['a']), sendEmail: false }, context: {} });
  assert.equal(sms()[0].host, 'api.dublin.ie1.twilio.com');
});

test('unknown Twilio regions fall back to global', async () => {
  seed([contact('a')]);
  const saved = await defs.saveProviderSettings({ payload: { twilioRegion: 'au1' } });
  assert.equal(saved.settings.twilioRegion, 'global');
});
