import Resolver from '@forge/resolver';
import api, { route, fetch } from '@forge/api';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();
const CONTACT_INDEX = 'system-alert:contacts:index';
const SETTINGS_KEY = 'system-alert:settings';
const AUTO_TEST_PREFIX = 'system-alert:auto-test:';
const DISPLAY_PROPERTY_KEY = 'system-alert-display';
const PROVIDER_SETTINGS_KEY = 'system-alert:providers';
const TEMPLATE_SETTINGS_KEY = 'system-alert:templates';
const BRANDING_SETTINGS_KEY = 'system-alert:branding';
const MAX_LOGO_DATA_LENGTH = 200000;
const PROVIDER_SECRET_KEYS = {
  sendgridApiKey: 'system-alert:provider:sendgrid-api-key',
  twilioAccountSid: 'system-alert:provider:twilio-account-sid',
  twilioAuthToken: 'system-alert:provider:twilio-auth-token',
  twilioApiKey: 'system-alert:provider:twilio-api-key',
  twilioApiSecret: 'system-alert:provider:twilio-api-secret'
};
const APP_VERSION = '3.7.9';

const DEFAULT_SETTINGS = {
  clientFieldId: '',
  issueStartFieldId: 'customfield_10786',
  nextUpdateFieldId: 'customfield_10788',
  allowedProjectKey: 'SD',
  priorityConfigs: [
    { name: 'P1', label: 'P1', color: '#AE2E24' },
    { name: 'P2', label: 'P2', color: '#B65C02' }
  ],
  fromName: 'Service Desk',
  replyToEmail: '',
  monthlyTestEnabled: true,
  monthlyTestHour: 10,
  emailEnabled: true,
  smsEnabled: true,
  twilioRegion: 'global'
};

const DEFAULT_PROVIDER_SETTINGS = {
  emailProvider: 'sendgrid',
  sendgridFromEmail: '',
  sendgridFromName: 'Service Desk',
  sendgridReplyToEmail: '',
  smsProvider: 'twilio',
  twilioRegion: 'global',
  twilioFromNumber: '',
  twilioMessagingServiceSid: ''
};

const DEFAULT_BRANDING = {
  serviceName: 'Service Desk',
  logoUrl: '',
  logoDataUri: '',
  logoFileName: '',
  headerBackground: '#172B4D',
  headerText: '#FFFFFF',
  accentColor: '#0C66E4',
  pageBackground: '#F1F2F4',
  footerBackground: '#F7F8F9',
  footerText: 'Please reference {{issueKey}} in any correspondence regarding this incident.',
  supportLabel: '',
  supportUrl: ''
};

const DEFAULT_TEMPLATES = {
  initial: {
    subject: '{{priority}} SYSTEM ALERT | {{clientCode}} | {{issueKey}} | {{summary}}',
    intro: 'A {{priority}} issue has been identified and our priority escalation process has been initiated.',
    followup: 'Our support team is actively managing this incident. A further update will be provided by the time shown above, or sooner if there is a significant change.',
    sms: 'Hi,\n\nA {{priority}} issue has been identified.\n\nIssue Start Time: {{startTime}}\n\nIssue: {{message}}\n\nNext Update Due: {{nextUpdate}}\n\nOur priority escalation process has started and a further update will follow shortly.\n\nMany Thanks'
  },
  update: {
    subject: '{{priority}} UPDATE | {{clientCode}} | {{issueKey}} | {{summary}}',
    intro: 'An update is available for this {{priority}} incident.',
    followup: 'Our support team is actively managing this incident. A further update will be provided by the time shown above, or sooner if there is a significant change.',
    sms: 'Hi,\n\nAn update is available for the {{priority}} issue.\n\nIssue Start Time: {{startTime}}\n\nIssue: {{message}}\n\nNext Update Due: {{nextUpdate}}\n\nOur priority escalation process remains active and a further update will follow shortly.\n\nMany Thanks'
  },
  resolved: {
    subject: 'SERVICE RESTORED | {{clientCode}} | {{issueKey}} | {{summary}}',
    intro: 'The {{priority}} incident has been resolved and service has been restored.',
    followup: 'No further incident updates are planned at this time. The Service Desk will continue to monitor the service.',
    sms: 'Hi,\n\nThe {{priority}} issue has now been resolved.\n\nIssue Start Time: {{startTime}}\n\nIssue: {{message}}\n\nService Status: Restored\n\nNo further updates are planned at this time.\n\nMany Thanks'
  },
  'monthly-test': {
    subject: 'TEST ONLY | MONTHLY SYSTEM ALERT TEST | {{clientCode}} | {{testMonth}}',
    intro: 'This is a scheduled test of the Service Desk System Alert service. There is no live service incident.',
    followup: 'No action is required unless acknowledgement is part of the agreed test process.',
    sms: 'Hi,\n\nThis is the scheduled monthly System Alert test for {{clientCode}}.\n\nThere is no live service incident.\n\nTest Month: {{testMonth}}\n{{referenceLine}}\nNo action is required unless acknowledgement is part of the agreed test process.\n\nMany Thanks'
  }
};

const safeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maskPhone = (p='') => p ? `${p.slice(0,4)}••••${p.slice(-3)}` : '';
const monthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
const monthLabel = (date = new Date()) => date.toLocaleString('en-IE', { month: 'long', year: 'numeric', timeZone: 'Europe/Dublin' });
const formatDateTime = (value='') => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Europe/Dublin'
  }).format(d).replace(',', '');
};

const adfToText = (node) => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  if (node.type === 'hardBreak') return '\n';
  const own = node.text || '';
  const children = (node.content || []).map(adfToText).join('');
  const block = ['paragraph','heading','bulletList','orderedList','listItem'].includes(node.type);
  return own + children + (block ? '\n' : '');
};

const fieldText = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(fieldText).filter(Boolean).join(', ');
  return v.value || v.name || v.displayName || v.key || v.label || '';
};

async function getSettings() {
  const settings = { ...DEFAULT_SETTINGS, ...((await kvs.get(SETTINGS_KEY)) || {}) };
  settings.priorityConfigs = normalizePriorityConfigs(settings.priorityConfigs);
  return settings;
}

async function getProviderSettings() {
  return { ...DEFAULT_PROVIDER_SETTINGS, ...((await kvs.get(PROVIDER_SETTINGS_KEY)) || {}) };
}

async function getProviderSecret(name) {
  const key = PROVIDER_SECRET_KEYS[name];
  return key ? (await kvs.getSecret(key)) || '' : '';
}

async function getTemplates() {
  const stored = (await kvs.get(TEMPLATE_SETTINGS_KEY)) || {};
  const out = {};
  for (const [key, defaults] of Object.entries(DEFAULT_TEMPLATES)) out[key] = { ...defaults, ...(stored[key] || {}) };
  return out;
}

async function getBranding() {
  return { ...DEFAULT_BRANDING, ...((await kvs.get(BRANDING_SETTINGS_KEY)) || {}) };
}

function normalizeHexColor(value, fallback) {
  const v = normalizeTextValue(value);
  return /^#[0-9A-F]{6}$/i.test(v) ? v.toUpperCase() : fallback;
}


function normalizeLogoDataUri(value='') {
  const v = String(value || '').trim();
  if (!v) return '';
  if (v.length > MAX_LOGO_DATA_LENGTH) throw new Error('Uploaded logo is too large. Please use a PNG or JPG under 140 KB.');
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(v)) throw new Error('Uploaded logo must be a PNG or JPG image.');
  return v;
}

function logoAttachmentFromBranding(branding = {}) {
  const dataUri = branding?.logoDataUri || '';
  const match = /^data:image\/(png|jpeg);base64,(.+)$/i.exec(dataUri);
  if (!match) return null;
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : 'png';
  return {
    content: match[2],
    type: `image/${match[1].toLowerCase()}`,
    filename: branding.logoFileName || `system-alert-logo.${ext}`,
    disposition: 'inline',
    content_id: 'system-alert-logo'
  };
}

function normalizeBranding(value = {}) {
  return {
    serviceName: normalizeTextValue(value.serviceName || DEFAULT_BRANDING.serviceName).slice(0, 80),
    logoUrl: normalizeTextValue(value.logoUrl).slice(0, 500),
    logoDataUri: normalizeLogoDataUri(value.logoDataUri),
    logoFileName: normalizeTextValue(value.logoFileName).slice(0, 120),
    headerBackground: normalizeHexColor(value.headerBackground, DEFAULT_BRANDING.headerBackground),
    headerText: normalizeHexColor(value.headerText, DEFAULT_BRANDING.headerText),
    accentColor: normalizeHexColor(value.accentColor, DEFAULT_BRANDING.accentColor),
    pageBackground: normalizeHexColor(value.pageBackground, DEFAULT_BRANDING.pageBackground),
    footerBackground: normalizeHexColor(value.footerBackground, DEFAULT_BRANDING.footerBackground),
    footerText: normalizeTextValue(value.footerText || DEFAULT_BRANDING.footerText).slice(0, 500),
    supportLabel: normalizeTextValue(value.supportLabel).slice(0, 80),
    supportUrl: normalizeTextValue(value.supportUrl).slice(0, 500)
  };
}

function templateType(alertType='initial') {
  return ['initial','update','resolved','monthly-test'].includes(alertType) ? alertType : 'initial';
}

function templateContext(a = {}) {
  const summary = subjectSummary(a);
  const startTime = a.startTime || 'Not specified';
  const nextUpdate = a.alertType === 'resolved' ? 'No further update planned' : (a.nextUpdate || 'To be confirmed');
  return {
    priority: a.priorityLabel || a.priority || 'Priority',
    jiraPriority: a.priority || '',
    clientCode: a.clientCode || '',
    issueKey: a.issueKey || '',
    summary,
    startTime,
    nextUpdate,
    message: a.message || a.summary || '',
    testMonth: a.testMonth || monthLabel(),
    referenceLine: a.issueKey ? `Reference: ${a.issueKey}\n` : ''
  };
}

function renderTemplate(value, a = {}) {
  const ctx = templateContext(a);
  return String(value || '').replace(/{{\s*([a-zA-Z0-9]+)\s*}}/g, (_, key) => Object.prototype.hasOwnProperty.call(ctx, key) ? String(ctx[key] ?? '') : `{{${key}}}`);
}

async function getContact(id) { return await kvs.getSecret(`system-alert:contact:${id}`); }
async function getAllContacts() {
  const ids = (await kvs.get(CONTACT_INDEX)) || [];
  const rows = await Promise.all(ids.map(getContact));
  return rows.filter(Boolean);
}

const normalizeTextValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (typeof v === 'object') return String(v.value ?? v.label ?? v.name ?? v.displayName ?? '').trim();
  return String(v).trim();
};

const normalizePriorities = (v) => {
  const arr = Array.isArray(v) ? v : (v ? [v] : []);
  return arr.map(normalizeTextValue).filter(Boolean);
};

const normalizePriorityConfigs = (value) => {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const rows = [];
  for (const item of raw) {
    const name = normalizeTextValue(typeof item === 'object' ? item.name : item);
    if (!name) continue;
    const key = name.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = normalizeTextValue(typeof item === 'object' ? item.label : '') || name;
    const colorRaw = normalizeTextValue(typeof item === 'object' ? item.color : '');
    const color = /^#[0-9A-F]{6}$/i.test(colorRaw) ? colorRaw.toUpperCase() : '#0C66E4';
    rows.push({ name, label, color });
  }
  return rows.length ? rows : [
    { name: 'P1', label: 'P1', color: '#AE2E24' },
    { name: 'P2', label: 'P2', color: '#B65C02' }
  ];
};

const priorityKey = (value='') => normalizeTextValue(value).toUpperCase();
const enabledPriorityNames = (settings) => normalizePriorityConfigs(settings?.priorityConfigs).map(p => p.name);
const isEnabledPriority = (settings, priority) => {
  const key = priorityKey(priority);
  return normalizePriorityConfigs(settings?.priorityConfigs).some(p => priorityKey(p.name) === key);
};
const getPriorityConfig = (settings, priority) => {
  const key = priorityKey(priority);
  return normalizePriorityConfigs(settings?.priorityConfigs).find(p => priorityKey(p.name) === key) || { name: normalizeTextValue(priority), label: normalizeTextValue(priority), color: '#0C66E4' };
};

async function syncDisplayProperty(settings) {
  const value = {
    projectKey: normalizeTextValue(settings.allowedProjectKey),
    priorities: enabledPriorityNames(settings)
  };
  const res = await api.asApp().requestJira(route`/rest/forge/1/app/properties/${DISPLAY_PROPERTY_KEY}`, {
    method: 'PUT',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`Could not update System Alert display configuration (${res.status}): ${await res.text()}`);
  return value;
}

function extractClientCode(raw='') {
  const value = normalizeTextValue(raw).toUpperCase();
  return value.includes(' - ') ? value.split(' - ')[0].trim() : value.trim();
}
function clientIdentity(raw) {
  const value = normalizeTextValue(raw);
  const optionId = raw && typeof raw === 'object' ? String(raw.id || '') : '';
  const code = extractClientCode(value);
  const name = value.includes(' - ') ? value.split(' - ').slice(1).join(' - ').trim() : value;
  return { optionId, value, code, name };
}
async function getJiraFields() {
  const res = await api.asUser().requestJira(route`/rest/api/3/field`);
  if (!res.ok) throw new Error(`Could not read Jira fields (${res.status}).`);
  const fields = await res.json();
  return (Array.isArray(fields) ? fields : []).map(f => ({
    id: String(f.id || ''),
    name: normalizeTextValue(f.name),
    custom: Boolean(f.custom),
    schemaType: normalizeTextValue(f.schema?.type),
    schemaCustom: normalizeTextValue(f.schema?.custom)
  })).filter(f => f.id && f.name).sort((a,b) => a.name.localeCompare(b.name));
}

async function getClientOptions(fieldId) {
  if (!fieldId) return [];
  const contextsRes = await api.asUser().requestJira(route`/rest/api/3/field/${fieldId}/context?maxResults=100`);
  if (!contextsRes.ok) throw new Error(`Could not read client field contexts (${contextsRes.status}).`);
  const contexts = (await contextsRes.json()).values || [];
  const options = [];
  for (const ctx of contexts) {
    let startAt = 0;
    while (true) {
      const res = await api.asUser().requestJira(route`/rest/api/3/field/${fieldId}/context/${ctx.id}/option?startAt=${startAt}&maxResults=100`);
      if (!res.ok) throw new Error(`Could not read client field options (${res.status}).`);
      const page = await res.json();
      for (const o of page.values || []) {
        if (o.disabled) continue;
        const ident = clientIdentity({ id:o.id, value:o.value });
        if (ident.value && !options.some(x => x.optionId === ident.optionId)) options.push(ident);
      }
      if (page.isLast || !(page.values || []).length) break;
      startAt += (page.values || []).length;
    }
  }
  return options.sort((a,b) => a.value.localeCompare(b.value));
}
async function providerStatus() {
  const cfg = await getProviderSettings();
  const sendgridApiKey = (await getProviderSecret('sendgridApiKey')) || process.env.SENDGRID_API_KEY || '';
  const sendgridFromEmail = cfg.sendgridFromEmail || process.env.ALERT_FROM_EMAIL || '';
  const twilioAccountSid = (await getProviderSecret('twilioAccountSid')) || process.env.TWILIO_ACCOUNT_SID || '';
  const twilioPassword = (await getProviderSecret('twilioApiSecret')) || (await getProviderSecret('twilioAuthToken')) || process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN || '';
  const twilioSender = cfg.twilioMessagingServiceSid || cfg.twilioFromNumber || process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER || '';
  return {
    email: { configured: Boolean(sendgridApiKey && sendgridFromEmail), provider: 'SendGrid', from: sendgridFromEmail, source: (await getProviderSecret('sendgridApiKey')) ? 'App settings' : (process.env.SENDGRID_API_KEY ? 'Forge environment' : '') },
    sms: { configured: Boolean(twilioAccountSid && twilioPassword && twilioSender), provider: 'Twilio', sender: twilioSender, source: (await getProviderSecret('twilioAccountSid')) ? 'App settings' : (process.env.TWILIO_ACCOUNT_SID ? 'Forge environment' : '') }
  };
}


function dublinDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc; }, {});
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    weekday: parts.weekday, hour: Number(parts.hour)
  };
}

function isFirstWednesdayNow(date, targetHour) {
  const p = dublinDateParts(date);
  return p.weekday === 'Wed' && p.day <= 7 && p.hour >= Number(targetHour ?? 10);
}

async function buildAutoTestStatus(contacts, settings) {
  const clients = [...new Set(contacts.filter(c => c.active !== false && c.monthlyTestAlerts === true).map(c => normalizeTextValue(c.clientCode).toUpperCase()).filter(Boolean))].sort();
  const rows = [];
  for (const clientCode of clients) {
    const history = (await kvs.get(`system-alert:test-history:${clientCode}`)) || [];
    const last = history.find(h => h.automatic === true) || history[0] || null;
    rows.push({ clientCode, last });
  }
  return { enabled: settings.monthlyTestEnabled !== false, hour: Number(settings.monthlyTestHour ?? 10), clients: rows };
}

resolver.define('getAdminData', async () => {
  const settings = await getSettings();
  const rawContacts = await getAllContacts();
  const contacts = [];

  for (const c of rawContacts) {
    const normalized = {
      ...c,
      clientCode: normalizeTextValue(c.clientCode).toUpperCase(),
      clientName: normalizeTextValue(c.clientName),
      name: normalizeTextValue(c.name),
      email: normalizeTextValue(c.email),
      mobile: normalizeTextValue(c.mobile),
      priorities: normalizePriorities(c.priorities),
      emailAlerts: c.emailAlerts === true,
      smsAlerts: c.smsAlerts === true,
      monthlyTestAlerts: c.monthlyTestAlerts === true,
      active: c.active !== false
    };

    // Repair legacy records created by earlier versions of the app.
    const changed = JSON.stringify({
      email:c.email, mobile:c.mobile, priorities:c.priorities, emailAlerts:c.emailAlerts, smsAlerts:c.smsAlerts, monthlyTestAlerts:c.monthlyTestAlerts
    }) !== JSON.stringify({
      email:normalized.email, mobile:normalized.mobile, priorities:normalized.priorities, emailAlerts:normalized.emailAlerts, smsAlerts:normalized.smsAlerts, monthlyTestAlerts:normalized.monthlyTestAlerts
    });
    if (changed && normalized.id) {
      await kvs.setSecret(`system-alert:contact:${normalized.id}`, normalized);
    }

    contacts.push({ ...normalized, mobileMasked: maskPhone(normalized.mobile) });
  }

  const autoTestStatus = await buildAutoTestStatus(contacts, settings);
  let clientOptions = [];
  let jiraFields = [];
  try { jiraFields = await getJiraFields(); } catch (e) { console.warn('Could not load Jira fields:', e.message); }
  try { clientOptions = await getClientOptions(settings.clientFieldId); } catch (e) { console.warn('Could not load client options:', e.message); }
  // Keep Jira display conditions in sync with the admin configuration.
  // This also seeds the property automatically after upgrading from an older version.
  try { await syncDisplayProperty(settings); } catch (e) { console.warn('Could not sync display property:', e.message); }
  const providers = await getProviderSettings();
  const templates = await getTemplates();
  const branding = await getBranding();
  const pStatus = await providerStatus();
  const setupStatus = {
    jira: Boolean(settings.allowedProjectKey && settings.clientFieldId && settings.priorityConfigs?.length),
    clients: clientOptions.length > 0,
    email: pStatus.email.configured,
    sms: pStatus.sms.configured,
    contacts: contacts.length
  };
  return { settings, contacts, clientOptions, jiraFields, providerSettings: providers, templates, branding, providerStatus: pStatus, setupStatus, autoTestStatus, appVersion: APP_VERSION };
});

resolver.define('saveSettings', async ({ payload }) => {
  const current = await getSettings();
  const next = { ...current, ...payload, priorityConfigs: normalizePriorityConfigs(payload.priorityConfigs ?? current.priorityConfigs) };
  if (!normalizeTextValue(next.allowedProjectKey)) throw new Error('An allowed Jira project key is required.');
  if (!next.priorityConfigs.length) throw new Error('Configure at least one System Alert priority.');
  // Update the Jira app property first because issue-panel/action visibility reads this property.
  await syncDisplayProperty(next);
  await kvs.set(SETTINGS_KEY, next);
  return next;
});

resolver.define('saveProviderSettings', async ({ payload }) => {
  const current = await getProviderSettings();
  const next = {
    ...current,
    emailProvider: 'sendgrid',
    sendgridFromEmail: normalizeTextValue(payload.sendgridFromEmail),
    sendgridFromName: normalizeTextValue(payload.sendgridFromName) || 'Service Desk',
    sendgridReplyToEmail: normalizeTextValue(payload.sendgridReplyToEmail),
    smsProvider: 'twilio',
    twilioRegion: payload.twilioRegion === 'ie1' ? 'ie1' : 'global',
    twilioFromNumber: normalizeTextValue(payload.twilioFromNumber),
    twilioMessagingServiceSid: normalizeTextValue(payload.twilioMessagingServiceSid)
  };
  await kvs.set(PROVIDER_SETTINGS_KEY, next);
  const secretInputs = {
    sendgridApiKey: payload.sendgridApiKey,
    twilioAccountSid: payload.twilioAccountSid,
    twilioAuthToken: payload.twilioAuthToken,
    twilioApiKey: payload.twilioApiKey,
    twilioApiSecret: payload.twilioApiSecret
  };
  for (const [name, value] of Object.entries(secretInputs)) {
    const clean = normalizeTextValue(value);
    if (clean) await kvs.setSecret(PROVIDER_SECRET_KEYS[name], clean);
  }
  return { settings: next, status: await providerStatus() };
});

resolver.define('saveTemplates', async ({ payload }) => {
  const current = await getTemplates();
  const next = { ...current };
  for (const type of ['initial','update','resolved','monthly-test']) {
    if (!payload?.[type]) continue;
    next[type] = {
      ...current[type],
      subject: String(payload[type].subject ?? current[type].subject).trim(),
      intro: String(payload[type].intro ?? current[type].intro).trim(),
      followup: String(payload[type].followup ?? current[type].followup).trim(),
      sms: String(payload[type].sms ?? current[type].sms).trim()
    };
  }
  await kvs.set(TEMPLATE_SETTINGS_KEY, next);
  return next;
});

resolver.define('resetTemplates', async () => {
  await kvs.delete(TEMPLATE_SETTINGS_KEY);
  return await getTemplates();
});

resolver.define('saveBranding', async ({ payload }) => {
  const branding = normalizeBranding(payload || {});
  await kvs.set(BRANDING_SETTINGS_KEY, branding);
  return branding;
});

resolver.define('resetBranding', async () => {
  await kvs.delete(BRANDING_SETTINGS_KEY);
  return await getBranding();
});

resolver.define('previewTemplate', async ({ payload }) => {
  const type = templateType(payload?.templateType || 'initial');
  const templates = await getTemplates();
  const draftTemplate = payload?.template || {};
  const mergedTemplates = { ...templates, [type]: { ...templates[type], ...draftTemplate } };
  const branding = normalizeBranding(payload?.branding || await getBranding());
  const settings = await getSettings();
  const priorityConfig = getPriorityConfig(settings, 'P1');
  const a = {
    alertType: type,
    issueKey: 'SD-12345',
    clientCode: 'CLIENT',
    priority: 'P1',
    priorityLabel: priorityConfig.label || 'P1',
    priorityConfig,
    summary: 'Example customer-facing incident',
    startTime: '17 Aug 2026 09:00',
    nextUpdate: '10:00 Irish time',
    message: type === 'monthly-test' ? 'Scheduled monthly communications test.' : 'Customers are currently experiencing an interruption to the affected service.',
    testMonth: 'August 2026',
    fromName: branding.serviceName || settings.fromName || 'Service Desk'
  };
  return {
    subject: buildEmailSubject(a, mergedTemplates),
    html: buildEmailHtml(a, mergedTemplates, branding),
    text: buildEmailText(a, mergedTemplates),
    sms: buildSmsText(a, mergedTemplates),
    model: buildPreviewModel(a, mergedTemplates, branding)
  };
});

resolver.define('saveContact', async ({ payload }) => {
  const settings = await getSettings();
  const id = payload.id || safeId();
  const options = await getClientOptions(settings.clientFieldId);
  const selectedClient = options.find(o => String(o.optionId) === String(payload.clientOptionId || ''));
  if (!selectedClient) throw new Error('Select a valid client from the configured Jira Client field.');
  const contact = {
    id,
    clientOptionId: selectedClient.optionId,
    clientValue: selectedClient.value,
    clientCode: selectedClient.code,
    clientName: selectedClient.name,
    name: String(payload.name || '').trim(),
    email: normalizeTextValue(payload.email),
    mobile: normalizeTextValue(payload.mobile),
    priorities: normalizePriorities(payload.priorities).filter(p => isEnabledPriority(settings, p)),
    emailAlerts: payload.emailAlerts === true,
    smsAlerts: payload.smsAlerts === true,
    monthlyTestAlerts: payload.monthlyTestAlerts === true,
    active: payload.active !== false
  };
  if (!contact.clientCode || !contact.name) throw new Error('Client and contact name are required.');
  const existing = await getAllContacts();
  const duplicate = existing.find(c => c.id !== id && String(c.clientOptionId || '') === String(contact.clientOptionId) && ((contact.email && normalizeTextValue(c.email).toLowerCase() === contact.email.toLowerCase()) || (contact.mobile && normalizeTextValue(c.mobile) === contact.mobile)));
  if (duplicate) throw new Error('A contact with this email address or mobile number already exists for the selected client.');
  await kvs.setSecret(`system-alert:contact:${id}`, contact);
  const ids = (await kvs.get(CONTACT_INDEX)) || [];
  if (!ids.includes(id)) await kvs.set(CONTACT_INDEX, [...ids, id]);
  return { ...contact, mobileMasked: maskPhone(contact.mobile) };
});

resolver.define('testContact', async ({ payload }) => {
  const settings = await getSettings();
  const c = await getContact(payload.id);
  if (!c) throw new Error('Contact not found.');
  const channel = payload.channel;
  if (channel === 'email') {
    if (!c.email) throw new Error('This contact has no email address.');
    await sendEmail([c.email], 'TEST ONLY | System Alert contact test', '<div style="font-family:Arial,sans-serif"><h2>System Alert contact test</h2><p>This is a test email from System Alert Manager. No live incident is in progress.</p></div>', 'System Alert contact test. No live incident is in progress.', settings.fromName, settings.replyToEmail);
    return { ok:true, channel:'email' };
  }
  if (channel === 'sms') {
    if (!c.mobile) throw new Error('This contact has no mobile number.');
    await sendTwilio(c.mobile, 'TEST ONLY - System Alert contact test. No live incident is in progress.');
    return { ok:true, channel:'sms' };
  }
  throw new Error('Choose Email or SMS test.');
});

resolver.define('deleteContact', async ({ payload }) => {
  const ids = (await kvs.get(CONTACT_INDEX)) || [];
  await kvs.deleteSecret(`system-alert:contact:${payload.id}`);
  await kvs.set(CONTACT_INDEX, ids.filter(x => x !== payload.id));
  return true;
});

resolver.define('getIssueAlertData', async ({ payload }) => {
  const settings = await getSettings();
  const fieldList = ['summary','description','priority','project'];
  if (settings.clientFieldId) fieldList.push(settings.clientFieldId);
  if (settings.issueStartFieldId) fieldList.push(settings.issueStartFieldId);
  if (settings.nextUpdateFieldId) fieldList.push(settings.nextUpdateFieldId);
  const r = await api.asUser().requestJira(route`/rest/api/3/issue/${payload.issueKey}?fields=${fieldList.join(',')}`);
  if (!r.ok) throw new Error(`Could not read Jira issue (${r.status}).`);
  const issue = await r.json();
  if (settings.allowedProjectKey && issue.fields.project?.key !== settings.allowedProjectKey) throw new Error('System Alert is not enabled for this project.');

  const currentClient = settings.clientFieldId ? clientIdentity(issue.fields[settings.clientFieldId]) : { optionId:'', code:'', name:'', value:'' };
  const clientCode = currentClient.code;
  const priority = fieldText(issue.fields.priority) || '';
  if (!isEnabledPriority(settings, priority)) throw new Error(`System Alert is not enabled for priority ${priority || 'Not set'}.`);
  const priorityConfig = getPriorityConfig(settings, priority);
  const issueStartTime = settings.issueStartFieldId ? formatDateTime(fieldText(issue.fields[settings.issueStartFieldId])) : '';
  const nextUpdateDue = settings.nextUpdateFieldId ? formatDateTime(fieldText(issue.fields[settings.nextUpdateFieldId])) : '';
  const all = await getAllContacts();
  const contacts = all.map(c => ({
    ...c,
    clientCode: normalizeTextValue(c.clientCode).toUpperCase(),
    name: normalizeTextValue(c.name),
    email: normalizeTextValue(c.email),
    mobile: normalizeTextValue(c.mobile),
    priorities: normalizePriorities(c.priorities),
    emailAlerts: c.emailAlerts === true,
    smsAlerts: c.smsAlerts === true,
    monthlyTestAlerts: c.monthlyTestAlerts === true,
    active: c.active !== false
  })).filter(c => c.active && ((currentClient.optionId && c.clientOptionId) ? String(c.clientOptionId) === String(currentClient.optionId) : c.clientCode === clientCode)).map(c => ({
    id: c.id,
    name: c.name,
    email: c.email,
    hasMobile: Boolean(c.mobile),
    mobileMasked: maskPhone(c.mobile),
    emailAlerts: c.emailAlerts,
    smsAlerts: c.smsAlerts,
    monthlyTestAlerts: c.monthlyTestAlerts,
    priorities: c.priorities
  }));

  const history = (await kvs.get(`system-alert:history:${payload.issueKey}`)) || [];
  const monthlyHistory = (await kvs.get(`system-alert:test-history:${clientCode}`)) || [];
  const thisMonth = monthKey();
  const monthlyTestCompleted = monthlyHistory.some(h => h.monthKey === thisMonth);

  return {
    issueKey: issue.key,
    summary: issue.fields.summary || '',
    description: adfToText(issue.fields.description).trim(),
    priority,
    priorityLabel: priorityConfig.label,
    priorityColor: priorityConfig.color,
    clientCode,
    issueStartTime,
    nextUpdateDue,
    contacts,
    history,
    monthlyHistory,
    monthlyTestCompleted,
    monthlyTestMonth: monthLabel(),
    settings: { emailEnabled: settings.emailEnabled, smsEnabled: settings.smsEnabled, fromName: settings.fromName, priorityConfigs: settings.priorityConfigs }
  };
});

function emailPresentation(a) {
  const isTest = a.alertType === 'monthly-test';
  const isResolved = a.alertType === 'resolved';
  const isUpdate = a.alertType === 'update';
  const priority = String(a.priority || '').trim();
  const priorityLabel = a.priorityLabel || a.priorityConfig?.label || priority || 'Priority';
  const priorityColor = a.priorityConfig?.color || '#AE2E24';

  if (isTest) return {
    eyebrow: 'SYSTEM ALERT TEST', badge: 'TEST ONLY', accent: '#B65C02', soft: '#FFF7D6', border: '#E2B203',
    title: 'Monthly System Alert Test', status: 'Scheduled test — no live service incident',
    intro: 'This is a scheduled test of the Service Desk System Alert service. There is no live service incident.'
  };
  if (isResolved) return {
    eyebrow: 'SERVICE STATUS', badge: 'SERVICE RESTORED', accent: '#216E4E', soft: '#DCFFF1', border: '#4BCE97',
    title: a.summary || 'Service restored', status: 'Resolved / service restored',
    intro: `The ${priorityLabel} incident has been resolved and service has been restored.`
  };
  const soft = priorityColor.toUpperCase() === '#B65C02' ? '#FFF3E0' : '#FFECEB';
  const border = priorityColor.toUpperCase() === '#B65C02' ? '#F5A623' : priorityColor;
  return {
    eyebrow: isUpdate ? 'INCIDENT UPDATE' : 'SYSTEM ALERT',
    badge: isUpdate ? `${priorityLabel} UPDATE` : `${priorityLabel} SYSTEM ALERT`,
    accent: priorityColor, soft, border,
    title: a.summary || `${priorityLabel} incident`,
    status: isUpdate ? 'Incident update' : 'Investigation in progress',
    intro: isUpdate ? `An update is available for this ${priorityLabel} incident.` : `A ${priorityLabel} issue has been identified and our priority escalation process has been initiated.`
  };
}


function buildPreviewModel(a, templates = DEFAULT_TEMPLATES, brandingInput = DEFAULT_BRANDING) {
  const p = emailPresentation(a);
  const branding = normalizeBranding(brandingInput || DEFAULT_BRANDING);
  const type = templateType(a.alertType);
  const template = templates?.[type] || {};
  const isTest = a.alertType === 'monthly-test';
  const isResolved = a.alertType === 'resolved';
  const defaultFollowup = isTest
    ? 'No action is required unless acknowledgement is part of the agreed test process.'
    : isResolved
      ? 'No further incident updates are planned at this time. The Service Desk will continue to monitor the service.'
      : 'Our support team is actively managing this incident. A further update will be provided by the time shown above, or sooner if there is a significant change.';
  return {
    issueKey: a.issueKey,
    clientCode: a.clientCode,
    priority: a.priority,
    priorityLabel: a.priorityLabel || a.priority,
    summary: a.summary,
    alertType: a.alertType,
    startTime: a.startTime,
    nextUpdate: a.nextUpdate,
    message: a.message,
    testMonth: a.testMonth,
    fromName: branding.serviceName || a.fromName || 'Service Desk',
    presentation: p,
    branding,
    intro: renderTemplate(template.intro || p.intro, a),
    followup: renderTemplate(template.followup || defaultFollowup, a),
    footerText: renderTemplate(branding.footerText || DEFAULT_BRANDING.footerText, a),
    supportLabel: branding.supportLabel || '',
    supportUrl: branding.supportUrl || '',
    logoUrl: branding.logoUrl || '',
    logoSrc: branding.logoDataUri || branding.logoUrl || ''
  };
}

function subjectSummary(a) {
  const summary = String(a.summary || '').trim();
  const client = String(a.clientCode || '').trim();
  if (!client || !summary) return summary;
  // Ticket summaries often already begin with the client code (for example "RYR - ...").
  // Remove that prefix in the email subject so the client is not shown twice.
  const escaped = client.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return summary.replace(new RegExp(`^${escaped}\\s*(?:[-–—:|]\\s*)`, 'i'), '').trim() || summary;
}

function buildEmailSubject(a, templates = DEFAULT_TEMPLATES) {
  const type = templateType(a.alertType);
  const configured = templates?.[type]?.subject;
  if (configured) return renderTemplate(configured, a);
  const summary = subjectSummary(a);
  if (a.alertType === 'monthly-test') return `TEST ONLY | MONTHLY SYSTEM ALERT TEST | ${a.clientCode} | ${a.testMonth || monthLabel()}`;
  if (a.alertType === 'resolved') return `SERVICE RESTORED | ${a.clientCode} | ${a.issueKey} | ${summary}`;
  const priorityLabel = a.priorityLabel || a.priority;
  if (a.alertType === 'update') return `${priorityLabel} UPDATE | ${a.clientCode} | ${a.issueKey} | ${summary}`;
  return `${priorityLabel} SYSTEM ALERT | ${a.clientCode} | ${a.issueKey} | ${summary}`;
}

function buildEmailText(a, templates = DEFAULT_TEMPLATES) {
  const p = emailPresentation(a);
  const template = templates?.[templateType(a.alertType)] || {};
  const intro = renderTemplate(template.intro || p.intro, a);
  const defaultFollowup = a.alertType === 'monthly-test'
    ? 'No action is required unless acknowledgement is part of the agreed test process.'
    : a.alertType === 'resolved'
      ? 'No further incident updates are planned at this time. The Service Desk will continue to monitor the service.'
      : 'Our support team is actively managing this incident. A further update will be provided by the time shown above, or sooner if there is a significant change.';
  const followup = renderTemplate(template.followup || defaultFollowup, a);
  if (a.alertType === 'monthly-test') return `${buildEmailSubject(a, templates)}

TEST ONLY — NO LIVE SERVICE INCIDENT.

${intro}

${a.issueKey ? `Reference: ${a.issueKey}
` : ''}Customer: ${a.clientCode}
Test month: ${a.testMonth || monthLabel()}
Status: ${p.status}

Test details:
${a.message}

${followup}`;
  return `${buildEmailSubject(a, templates)}

${intro}

Reference: ${a.issueKey}
Customer: ${a.clientCode}
Priority: ${a.priorityLabel || a.priority}
Issue Start Time: ${a.startTime || 'Not specified'}
Next Update Due: ${a.alertType === 'resolved' ? 'No further update planned' : (a.nextUpdate || 'To be confirmed')}
Status: ${p.status}

Current situation:
${a.message}

${followup}

Please reference ${a.issueKey} in any correspondence regarding this incident.`;
}

function buildEmailHtml(a, templates = DEFAULT_TEMPLATES, brandingInput = DEFAULT_BRANDING) {
  const p = emailPresentation(a);
  const branding = normalizeBranding(brandingInput || DEFAULT_BRANDING);
  const isTest = a.alertType === 'monthly-test';
  const isResolved = a.alertType === 'resolved';
  const next = isResolved ? 'No further update planned' : (a.nextUpdate || 'To be confirmed');
  const fromName = branding.serviceName || a.fromName || 'Service Desk';
  const details = isTest
    ? [ ...(a.issueKey ? [['Reference', a.issueKey]] : []), ['Customer', a.clientCode], ['Test month', a.testMonth || monthLabel()], ['Current status', p.status] ]
    : [ ['Reference', a.issueKey], ['Customer', a.clientCode], ['Priority', a.priorityLabel || a.priority], ['Issue Start Time', a.startTime || 'Not specified'], ['Next Update Due', next], ['Current status', p.status] ];
  const rows = details.map(([k,v],i) => {
    const borderStyle = i < details.length - 1 ? 'border-bottom:1px solid #EBECF0;' : '';
    const valueHtml = k === 'Priority'
      ? `<span style="display:inline-block;background:${p.accent};color:#FFFFFF;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700">${esc(v)}</span>`
      : esc(v);
    return `<tr><td style="width:34%;padding:11px 14px;color:#626f86;font-size:13px;${borderStyle}">${esc(k)}</td><td style="padding:11px 14px;color:#172B4D;font-size:13px;font-weight:700;${borderStyle}">${valueHtml}</td></tr>`;
  }).join('');
  const alertBox = isTest ? `<tr><td style="padding:0 32px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.soft};border:1px solid ${p.border};border-radius:8px"><tr><td style="padding:15px 17px;color:#533F04;font-size:14px;line-height:1.5"><strong>TEST ONLY — NO LIVE SERVICE INCIDENT</strong><br>This message is part of the scheduled monthly System Alert test.</td></tr></table></td></tr>` : '';
  const template = templates?.[templateType(a.alertType)] || {};
  const intro = renderTemplate(template.intro || p.intro, a);
  const defaultFollowup = isTest ? 'No action is required unless acknowledgement is part of the agreed test process.' : isResolved ? 'No further incident updates are planned at this time. The Service Desk will continue to monitor the service.' : 'Our support team is actively managing this incident. A further update will be provided by the time shown above, or sooner if there is a significant change.';
  const followup = renderTemplate(template.followup || defaultFollowup, a);

  const logoSrc = branding.logoDataUri ? 'cid:system-alert-logo' : branding.logoUrl;
  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="" style="display:block;max-height:44px;max-width:190px;margin-bottom:13px;border:0">`
    : '';
  const support = branding.supportUrl
    ? `<div style="margin-top:6px"><a href="${esc(branding.supportUrl)}" style="color:${branding.accentColor};text-decoration:none">${esc(branding.supportLabel || branding.supportUrl)}</a></div>`
    : '';
  const footerText = renderTemplate(branding.footerText || DEFAULT_BRANDING.footerText, a);

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:${branding.pageBackground};font-family:Arial,Helvetica,sans-serif;color:#172B4D"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${branding.pageBackground}"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#FFFFFF;border:1px solid #DFE1E6;border-radius:12px;overflow:hidden"><tr><td style="background:${branding.headerBackground};padding:25px 32px">${logo}<div style="font-size:12px;line-height:1.2;letter-spacing:1.5px;font-weight:700;color:${branding.headerText};opacity:.75">${esc(fromName.toUpperCase())}</div><div style="margin-top:8px;font-size:25px;line-height:1.25;font-weight:700;color:${branding.headerText}">${esc(p.title)}</div></td></tr><tr><td style="padding:24px 32px 14px"><div style="display:inline-block;background:${p.accent};color:#FFFFFF;border-radius:5px;padding:9px 14px;font-size:13px;line-height:1.2;font-weight:700;letter-spacing:.3px">${esc(p.badge)}</div><div style="margin-top:18px;font-size:15px;line-height:1.6;color:#172B4D">${esc(intro)}</div></td></tr>${alertBox}<tr><td style="padding:4px 32px 20px"><div style="font-size:16px;font-weight:700;margin-bottom:10px">Incident details</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DFE1E6;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden">${rows}</table></td></tr><tr><td style="padding:0 32px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.soft};border-left:4px solid ${p.accent};border-radius:6px"><tr><td style="padding:17px 18px"><div style="font-size:16px;font-weight:700;margin-bottom:9px">${isTest?'Test details':'Current situation'}</div><div style="font-size:14px;line-height:1.65;white-space:pre-line">${esc(a.message || '')}</div></td></tr></table><div style="font-size:14px;line-height:1.6;margin-top:20px">${esc(followup)}</div></td></tr><tr><td style="background:${branding.footerBackground};border-top:1px solid #EBECF0;padding:19px 32px;color:#626F86;font-size:12px;line-height:1.55"><strong style="color:#44546F">${esc(fromName)}</strong><br>${esc(isTest ? 'Scheduled System Alert test.' : footerText)}${support}</td></tr></table></td></tr></table></body></html>`;
}

function buildSmsText(a, templates = DEFAULT_TEMPLATES) {
  const configured = templates?.[templateType(a.alertType)]?.sms;
  if (configured) return renderTemplate(configured, a).slice(0, 700);
  const issueText = (a.message || a.summary || '').trim();
  const start = a.startTime || 'Not specified';
  const next = a.nextUpdate || 'To be confirmed';

  if (a.alertType === 'monthly-test') {
    return `Hi,\n\nThis is the scheduled monthly System Alert test for ${a.clientCode}.\n\nThere is no live service incident.\n\nTest Month: ${a.testMonth || monthLabel()}\n${a.issueKey ? `Reference: ${a.issueKey}\n\n` : ''}No action is required unless acknowledgement is part of the agreed test process.\n\nMany Thanks`.slice(0, 700);
  }

  if (a.alertType === 'resolved') {
    return `Hi,\n\nThe ${a.priorityLabel || a.priority} issue has now been resolved.\n\nIssue Start Time: ${start}\n\nIssue: ${issueText}\n\nService Status: Restored\n\nNo further updates are planned at this time.\n\nMany Thanks`.slice(0, 700);
  }

  if (a.alertType === 'update') {
    return `Hi,\n\nAn update is available for the ${a.priorityLabel || a.priority} issue.\n\nIssue Start Time: ${start}\n\nIssue: ${issueText}\n\nNext Update Due: ${next}\n\nOur priority escalation process remains active and a further update will follow shortly.\n\nMany Thanks`.slice(0, 700);
  }

  return `Hi,\n\nA ${a.priorityLabel || a.priority} issue has been identified.\n\nIssue Start Time: ${start}\n\nIssue: ${issueText}\n\nNext Update Due: ${next}\n\nOur priority escalation process has started and a further update will follow shortly.\n\nMany Thanks`.slice(0, 700);
}

async function sendTwilio(to, body) {
  const cfg = await getProviderSettings();
  const accountSid = (await getProviderSecret('twilioAccountSid')) || process.env.TWILIO_ACCOUNT_SID;
  const username = (await getProviderSecret('twilioApiKey')) || process.env.TWILIO_API_KEY || accountSid;
  const password = (await getProviderSecret('twilioApiSecret')) || (await getProviderSecret('twilioAuthToken')) || process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !username || !password) throw new Error('Twilio credentials are not configured. Add them in System Alert > Communication providers or Forge environment variables.');
  const regionName = cfg.twilioRegion || process.env.TWILIO_REGION || 'global';
  const region = regionName === 'ie1' ? 'https://api.dublin.ie1.twilio.com' : 'https://api.twilio.com';
  const params = new URLSearchParams({ To: to, Body: body });
  const messagingServiceSid = cfg.twilioMessagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = cfg.twilioFromNumber || process.env.TWILIO_FROM_NUMBER;
  if (messagingServiceSid) params.set('MessagingServiceSid', messagingServiceSid);
  else if (fromNumber) params.set('From', fromNumber);
  else throw new Error('Configure a Twilio Messaging Service SID or From number.');
  const res = await fetch(`${region}/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  if (!res.ok) throw new Error(`Twilio send failed (${res.status}): ${await res.text()}`);
  const j = await res.json();
  return { sid: j.sid, status: j.status };
}

async function sendEmail(toEmails, subject, html, text, fromName, replyToEmail='', branding=null) {
  const cfg = await getProviderSettings();
  const apiKey = (await getProviderSecret('sendgridApiKey')) || process.env.SENDGRID_API_KEY;
  const fromEmail = cfg.sendgridFromEmail || process.env.ALERT_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new Error('Email provider is not configured. Add the SendGrid API key and sender address in System Alert > Communication providers or Forge environment variables.');
  const recipients = [...new Set((toEmails || []).map(normalizeTextValue).filter(Boolean))];
  if (!recipients.length) return true;
  const replyTo = normalizeTextValue(cfg.sendgridReplyToEmail || replyToEmail || process.env.ALERT_REPLY_TO || fromEmail);
  const providerFromName = normalizeTextValue(cfg.sendgridFromName || process.env.ALERT_FROM_NAME || fromName || 'Service Desk');
  const body = {
    // One personalization per recipient prevents customers from seeing one another's addresses.
    personalizations: recipients.map(email => ({ to: [{ email }] })),
    from: { email: fromEmail, name: providerFromName },
    reply_to: { email: replyTo, name: process.env.ALERT_REPLY_TO_NAME || providerFromName },
    subject,
    content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }]
  };
  const logoAttachment = logoAttachmentFromBranding(branding || {});
  if (logoAttachment) body.attachments = [logoAttachment];
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method:'POST',
    headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${await res.text()}`);
  return true;
}

resolver.define('previewEmail', async ({ payload }) => {
  const settings = await getSettings();
  const fields = ['priority','project'];
  if (settings.clientFieldId) fields.push(settings.clientFieldId);
  if (settings.issueStartFieldId) fields.push(settings.issueStartFieldId);
  if (settings.nextUpdateFieldId) fields.push(settings.nextUpdateFieldId);
  const check = await api.asUser().requestJira(route`/rest/api/3/issue/${payload.issueKey}?fields=${fields.join(',')}`);
  if (!check.ok) throw new Error(`Could not validate Jira issue (${check.status}).`);
  const currentIssue = await check.json();
  const currentProject = currentIssue.fields.project?.key || '';
  const currentPriority = fieldText(currentIssue.fields.priority);
  if (settings.allowedProjectKey && currentProject !== settings.allowedProjectKey) throw new Error('System Alert is not enabled for this project.');
  if (!isEnabledPriority(settings, currentPriority)) throw new Error(`System Alert is not enabled for priority ${currentPriority || 'Not set'}.`);
  const currentPriorityConfig = getPriorityConfig(settings, currentPriority);
  const currentClientCode = settings.clientFieldId ? extractClientCode(currentIssue.fields[settings.clientFieldId]) : '';
  if (!currentClientCode) throw new Error('The Jira ticket does not have a valid client configured.');
  if (extractClientCode(payload.clientCode) !== currentClientCode) throw new Error('Client safety check failed: the alert client no longer matches the Jira ticket. Refresh the ticket before continuing.');

  // Prefer values currently entered in the alert form. If either field is empty,
  // fall back to the configured Jira custom field so the preview always matches the ticket.
  const startTime = payload.startTime || (settings.issueStartFieldId ? formatDateTime(fieldText(currentIssue.fields[settings.issueStartFieldId])) : '');
  const nextUpdate = payload.nextUpdate || (settings.nextUpdateFieldId ? formatDateTime(fieldText(currentIssue.fields[settings.nextUpdateFieldId])) : '');
  const a = { ...payload, clientCode: currentClientCode, startTime, nextUpdate, priority: currentPriority, priorityLabel: currentPriorityConfig.label, priorityConfig: currentPriorityConfig, fromName: settings.fromName, testMonth: payload.testMonth || monthLabel() };
  const templates = await getTemplates();
  const branding = await getBranding();
  const presentation = emailPresentation(a);
  return {
    subject: buildEmailSubject(a, templates),
    html: buildEmailHtml(a, templates, branding),
    text: buildEmailText(a, templates),
    model: buildPreviewModel(a, templates, branding)
  };
});

resolver.define('sendAlert', async ({ payload, context }) => {
  const settings = await getSettings();
  const validationFields = ['priority','project'];
  if (settings.clientFieldId) validationFields.push(settings.clientFieldId);
  const check = await api.asUser().requestJira(route`/rest/api/3/issue/${payload.issueKey}?fields=${validationFields.join(',')}`);
  if (!check.ok) throw new Error(`Could not validate Jira issue (${check.status}).`);
  const currentIssue = await check.json();
  const currentProject = currentIssue.fields.project?.key || '';
  const currentPriority = fieldText(currentIssue.fields.priority);
  if (settings.allowedProjectKey && currentProject !== settings.allowedProjectKey) throw new Error('System Alert is not enabled for this project.');
  if (!isEnabledPriority(settings, currentPriority)) throw new Error(`System Alert is not enabled for priority ${currentPriority || 'Not set'}.`);
  const currentPriorityConfig = getPriorityConfig(settings, currentPriority);
  const currentClient = settings.clientFieldId ? clientIdentity(currentIssue.fields[settings.clientFieldId]) : { optionId:'', code:'' };
  const currentClientCode = currentClient.code;
  if (!currentClientCode) throw new Error('The Jira ticket does not have a valid client configured. Alert blocked.');
  if (extractClientCode(payload.clientCode) !== currentClientCode) throw new Error('Client safety check failed: the alert client does not match the Jira ticket. Refresh before sending.');
  payload.priority = currentPriority;
  payload.clientCode = currentClientCode;
  const selected = await Promise.all((payload.contactIds || []).map(getContact));
  const contacts = selected.filter(Boolean).map(c => ({
    ...c,
    clientCode: normalizeTextValue(c.clientCode).toUpperCase(),
    name: normalizeTextValue(c.name),
    email: normalizeTextValue(c.email),
    mobile: normalizeTextValue(c.mobile),
    priorities: normalizePriorities(c.priorities),
    emailAlerts: c.emailAlerts === true,
    smsAlerts: c.smsAlerts === true,
    monthlyTestAlerts: c.monthlyTestAlerts === true,
    active: c.active !== false
  }));
  if (!contacts.length) throw new Error('Select at least one recipient.');
  const sameClient = c => (currentClient.optionId && c.clientOptionId) ? String(c.clientOptionId) === String(currentClient.optionId) : c.clientCode === currentClientCode;
  const wrongClient = contacts.filter(c => !sameClient(c));
  if (wrongClient.length) throw new Error(`Recipient safety check failed: ${wrongClient.length} selected contact(s) belong to a different Jira client. Nothing was sent.`);
  const activeClientContacts = contacts.filter(c => c.active && sameClient(c));
  if (activeClientContacts.length !== contacts.length) throw new Error('Recipient safety check failed: one or more selected contacts are inactive or do not belong to this client. Nothing was sent.');

  const isTest = payload.alertType === 'monthly-test';
  const eligibleContacts = activeClientContacts.filter(c => isTest ? c.monthlyTestAlerts === true : normalizePriorities(c.priorities).some(p => priorityKey(p) === priorityKey(payload.priority)));
  if (!eligibleContacts.length) throw new Error(isTest ? 'None of the selected contacts are enabled for Monthly Test alerts.' : `None of the selected contacts are enabled for ${payload.priority} alerts.`);

  const a = { ...payload, priorityLabel: currentPriorityConfig.label, priorityConfig: currentPriorityConfig, fromName: settings.fromName, testMonth: payload.testMonth || monthLabel() };
  const templates = await getTemplates();
  const branding = await getBranding();
  const subject = buildEmailSubject(a, templates);
  const text = buildEmailText(a, templates);
  const html = buildEmailHtml(a, templates, branding);

  const emailRecipients = payload.sendEmail
    ? [...new Set(eligibleContacts.filter(c => c.email && c.emailAlerts).map(c => c.email))]
    : [];
  const smsRecipients = payload.sendSms
    ? [...new Set(eligibleContacts.filter(c => c.mobile && c.smsAlerts).map(c => c.mobile))]
    : [];
  if (!emailRecipients.length && !smsRecipients.length) throw new Error('The selected recipients do not have an enabled email or SMS destination for this alert.');

  const results = { email: { attempted: emailRecipients.length, ok: false }, sms: { attempted: smsRecipients.length, sent: 0, failed: [] } };
  if (emailRecipients.length) {
    await sendEmail(emailRecipients, subject, html, text, settings.fromName, settings.replyToEmail, branding);
    results.email.ok = true;
  }

  const smsText = buildSmsText(a, templates);

  for (const mobile of smsRecipients) {
    try { await sendTwilio(mobile, smsText); results.sms.sent++; }
    catch (e) { results.sms.failed.push({ mobile: maskPhone(mobile), error: e.message }); }
  }

  const now = new Date().toISOString();
  const entry = {
    at: now,
    alertType: a.alertType,
    priority: a.priority,
    emailCount: emailRecipients.length,
    smsCount: results.sms.sent,
    senderAccountId: context.accountId || '',
    monthKey: isTest ? monthKey() : undefined,
    monthLabel: isTest ? a.testMonth : undefined
  };

  const issueHistoryKey = `system-alert:history:${a.issueKey}`;
  const history = (await kvs.get(issueHistoryKey)) || [];
  await kvs.set(issueHistoryKey, [entry, ...history].slice(0, 50));

  if (isTest) {
    const testHistoryKey = `system-alert:test-history:${a.clientCode}`;
    const testHistory = (await kvs.get(testHistoryKey)) || [];
    await kvs.set(testHistoryKey, [entry, ...testHistory].slice(0, 36));
  }

  const commentText = isTest
    ? `Monthly System Alert TEST sent — TEST ONLY | ${a.testMonth} | Email: ${emailRecipients.length} recipient(s) | SMS: ${results.sms.sent} recipient(s)`
    : `System Alert sent — ${a.alertType.toUpperCase()} | Email: ${emailRecipients.length} recipient(s) | SMS: ${results.sms.sent} recipient(s)${a.nextUpdate ? ` | Next update: ${a.nextUpdate}` : ''}`;
  results.comment = { ok: false };
  try {
    const commentRes = await api.asApp().requestJira(route`/rest/servicedeskapi/request/${a.issueKey}/comment`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({ body: commentText, public: false })
    });
    if (!commentRes.ok) {
      results.comment.error = `Internal Jira comment failed (${commentRes.status}): ${await commentRes.text()}`;
    } else {
      results.comment.ok = true;
    }
  } catch (e) {
    results.comment.error = e.message;
  }

  return { ...results, isTest, testMonth: a.testMonth };
});


export async function monthlyTestScheduler() {
  const settings = await getSettings();
  if (settings.monthlyTestEnabled === false) return { skipped: 'Automatic monthly test is disabled.' };
  const now = new Date();
  const targetHour = Number(settings.monthlyTestHour ?? 10);
  if (!isFirstWednesdayNow(now, targetHour)) return { skipped: 'Not the first Wednesday test window.' };

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

  const clients = [...new Set(all.filter(c => c.active && c.monthlyTestAlerts && c.clientCode).map(c => c.clientCode))].sort();
  const month = monthKey(now);
  const label = monthLabel(now);
  const results = [];

  for (const clientCode of clients) {
    const markerKey = `${AUTO_TEST_PREFIX}${clientCode}:${month}`;
    const marker = await kvs.get(markerKey);
    const runningAgeMs = marker?.status === 'running' && marker?.at ? (now.getTime() - new Date(marker.at).getTime()) : 0;
    if (marker?.status === 'sent' || (marker?.status === 'running' && runningAgeMs < 2 * 60 * 60 * 1000)) {
      results.push({ clientCode, skipped: 'Already processed this month.' });
      continue;
    }

    // Set the marker before external sends so the hourly trigger cannot send a second copy.
    await kvs.set(markerKey, { status: 'running', at: now.toISOString() });
    try {
      const clientContacts = all.filter(c => c.active && c.monthlyTestAlerts && c.clientCode === clientCode);
      const emailRecipients = [...new Set(clientContacts.filter(c => c.emailAlerts && c.email).map(c => c.email))];
      const smsRecipients = [...new Set(clientContacts.filter(c => c.smsAlerts && c.mobile).map(c => c.mobile))];
      if (!emailRecipients.length && !smsRecipients.length) {
        await kvs.set(markerKey, { status: 'skipped', at: now.toISOString(), reason: 'No enabled delivery channels.' });
        results.push({ clientCode, skipped: 'No enabled delivery channels.' });
        continue;
      }

      const a = {
        issueKey: '', clientCode, priority: '', alertType: 'monthly-test',
        summary: 'Monthly System Alert Test', message: `This is the scheduled monthly System Alert test for ${clientCode}.`,
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
        at: new Date().toISOString(), automatic: true, alertType: 'monthly-test',
        clientCode, emailCount: emailRecipients.length, emailOk,
        smsCount: smsSent, smsFailedCount: smsFailed.length,
        monthKey: month, monthLabel: label
      };
      const historyKey = `system-alert:test-history:${clientCode}`;
      const history = (await kvs.get(historyKey)) || [];
      await kvs.set(historyKey, [entry, ...history].slice(0, 36));
      await kvs.set(markerKey, { status: 'sent', at: entry.at, emailCount: emailRecipients.length, smsCount: smsSent, smsFailedCount: smsFailed.length });
      results.push({ clientCode, sent: true, emailCount: emailRecipients.length, smsCount: smsSent, smsFailedCount: smsFailed.length });
    } catch (e) {
      await kvs.set(markerKey, { status: 'failed', at: new Date().toISOString(), error: e.message });
      results.push({ clientCode, error: e.message });
    }
  }
  return { monthKey: month, monthLabel: label, results };
}

export const handler = resolver.getDefinitions();
