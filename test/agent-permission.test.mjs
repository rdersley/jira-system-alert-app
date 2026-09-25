// Behaviour tests for the service desk agent guard in src/secure-index.js. They
// run the real hardened resolver against in-memory fakes of Forge KVS and Jira.
// Run with --experimental-test-module-mocks (see package.json "test").
import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
const secrets = new Map();
const jiraCalls = [];
const jira = { agent: true, permissionStatus: 200 };

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
  text: async () => JSON.stringify(body),
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

const requestJira = async (path, init = {}) => {
  jiraCalls.push({ path, method: init.method || 'GET' });
  if (path.startsWith('/rest/api/3/mypermissions')) {
    if (jira.permissionStatus !== 200) return response(jira.permissionStatus, {});
    return response(200, { permissions: {
      SERVICEDESK_AGENT: { havePermission: jira.agent },
      ADMINISTER: { havePermission: true }
    } });
  }
  if (path.startsWith('/rest/api/3/issue/SD-1')) return response(200, ISSUE);
  if (path.includes('/comment')) return response(201, {});
  return response(404, {});
};

// Mirrors how Forge dispatches a resolver call to the function registered with define().
class Resolver {
  constructor() { this.defs = {}; }
  define(key, fn) { this.defs[key] = fn; }
  getDefinitions() { return request => this.defs[request.key](request); }
}

mock.module('@forge/kvs', { namedExports: { kvs } });
mock.module('@forge/resolver', { defaultExport: Resolver });
mock.module('@forge/api', {
  defaultExport: { asUser: () => ({ requestJira }), asApp: () => ({ requestJira }) },
  namedExports: {
    fetch: async () => { throw new Error('No real provider calls in tests.'); },
    getAppContext: () => ({}),
    route: (strings, ...values) => strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '')
  }
});

const secure = await import('../src/secure-index.js');
const call = (key, payload, context = { extension: { issue: { key: 'SD-1' } } }) => secure.handler({ key, payload, context });

const sendPayload = { issueKey: 'SD-1', clientCode: 'ACME', alertType: 'initial', contactIds: ['a'], sendEmail: true, sendSms: false, message: 'Investigating' };
const permissionChecks = () => jiraCalls.filter(c => c.path.startsWith('/rest/api/3/mypermissions'));
const history = () => store.get('system-alert:history:SD-1');

beforeEach(() => {
  store.clear(); secrets.clear(); jiraCalls.length = 0;
  jira.agent = true; jira.permissionStatus = 200;
  process.env.SYSTEM_ALERT_MOCK_PROVIDERS = 'true';
  store.set('system-alert:settings', {
    allowedProjectKey: 'SD', clientFieldId: 'customfield_client',
    priorityConfigs: [{ name: 'P1', label: 'P1', color: '#AE2E24' }]
  });
  store.set('system-alert:contacts:index', ['a']);
  secrets.set('system-alert:contact:a', {
    id: 'a', clientOptionId: '10', clientCode: 'ACME', name: 'Ann', email: 'ann@acme.test', mobile: '',
    priorities: ['P1'], emailAlerts: true, smsAlerts: false, monthlyTestAlerts: false, active: true
  });
});

test('agents can send an alert from the issue they have open', async () => {
  const result = await call('sendAlert', sendPayload);
  assert.equal(result.email.ok, true);
  assert.equal(permissionChecks()[0].path, '/rest/api/3/mypermissions?issueKey=SD-1&permissions=SERVICEDESK_AGENT');
  assert.equal(history().length, 1);
});

test('non-agents who can browse the issue cannot send an alert', async () => {
  jira.agent = false;
  await assert.rejects(call('sendAlert', sendPayload), /Only service desk agents/);
  assert.equal(history(), undefined);
  assert.equal(jiraCalls.some(c => c.path.includes('/comment')), false);
});

test('non-agents cannot read client contacts or preview alerts', async () => {
  jira.agent = false;
  await assert.rejects(call('getIssueAlertData', { issueKey: 'SD-1' }), /Only service desk agents/);
  await assert.rejects(call('previewEmail', { ...sendPayload }), /Only service desk agents/);
  // The guard runs before the resolver, so the issue and contacts are never read.
  assert.equal(jiraCalls.some(c => c.path.startsWith('/rest/api/3/issue/')), false);
});

test('a request for a different issue than the one open is rejected', async () => {
  await assert.rejects(
    call('sendAlert', sendPayload, { extension: { issue: { key: 'SD-99' } } }),
    /does not match the Jira issue that is open/
  );
  assert.equal(permissionChecks().length, 0);
  assert.equal(history(), undefined);
});

test('issue key comparison ignores case', async () => {
  const result = await call('sendAlert', sendPayload, { extension: { issue: { key: 'sd-1' } } });
  assert.equal(result.email.ok, true);
});

test('a modal without issue context still requires agent permission on the requested issue', async () => {
  const result = await call('getIssueAlertData', { issueKey: 'SD-1' }, { extension: { modal: { issueKey: 'SD-1' } } });
  assert.equal(result.issueKey, 'SD-1');
  assert.equal(permissionChecks().length, 1);

  jira.agent = false;
  await assert.rejects(call('sendAlert', sendPayload, {}), /Only service desk agents/);
});

test('a failed permission lookup blocks the request', async () => {
  jira.permissionStatus = 503;
  await assert.rejects(call('sendAlert', sendPayload), /Unable to verify service desk agent permission/);
  assert.equal(history(), undefined);
});

test('admin-only resolvers are unaffected by the agent guard', async () => {
  store.set('system-alert:contacts:index', []);
  await call('deleteContact', { id: 'a' });
  assert.equal(permissionChecks().length, 1);
  assert.match(permissionChecks()[0].path, /permissions=ADMINISTER$/);
});
