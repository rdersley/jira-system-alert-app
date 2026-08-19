import Resolver from '@forge/resolver';
import api, { route, getAppContext } from '@forge/api';

const ADMIN_RESOLVERS = new Set([
  'getAdminData',
  'saveSettings',
  'saveProviderSettings',
  'startMicrosoftMarketplaceConnection',
  'getMicrosoftMarketplaceSetup',
  'saveMicrosoftMarketplaceSettings',
  'verifyMicrosoftMarketplaceConnection',
  'disconnectMicrosoftMarketplace',
  'verifyMicrosoftEnterpriseConnection',
  'disconnectMicrosoftEnterprise',
  'testEmailProvider',
  'saveTemplates',
  'resetTemplates',
  'saveBranding',
  'resetBranding',
  'previewTemplate',
  'saveContact',
  'testContact',
  'deleteContact'
]);

// Operations that actually deliver a message must not run on an inactive
// Marketplace production licence. Development/staging remain usable so the
// app can be tested before the Marketplace listing is approved.
const LICENSED_DELIVERY_RESOLVERS = new Set([
  'sendAlert',
  'testEmailProvider',
  'testContact'
]);

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,63}$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{5,28}[0-9]$/;
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]{0,29}-[1-9][0-9]*$/i;
const SAFE_ID_RE = /^[A-Za-z0-9_.:-]{1,160}$/;
const ALLOWED_ALERT_TYPES = new Set(['initial', 'update', 'resolved', 'monthly-test']);

const text = value => value == null ? '' : String(value).trim();
const assertLength = (value, max, label) => {
  if (text(value).length > max) throw new Error(`${label} is too long (maximum ${max} characters).`);
};
const assertEmail = (value, label = 'Email address') => {
  const v = text(value);
  if (v && (v.length > 254 || !EMAIL_RE.test(v))) throw new Error(`${label} is not valid.`);
};
const assertPhone = (value, label = 'Mobile number') => {
  const v = text(value);
  if (v && !PHONE_RE.test(v)) throw new Error(`${label} is not valid. Use an international number such as +353...`);
};
const assertIssueKey = value => {
  if (!ISSUE_KEY_RE.test(text(value))) throw new Error('Invalid Jira issue key.');
};
const assertSafeId = (value, label = 'Identifier') => {
  if (!SAFE_ID_RE.test(text(value))) throw new Error(`Invalid ${label.toLowerCase()}.`);
};

function licenceState(context = {}) {
  const environmentType = text(context.environmentType).toUpperCase();
  const production = environmentType === 'PRODUCTION';
  const active = context?.license?.active === true || context?.license?.isActive === true;
  return {
    enforced: production,
    active: production ? active : true,
    environmentType: environmentType || 'UNKNOWN'
  };
}

function requireActiveLicence(context) {
  const licence = licenceState(context);
  if (licence.enforced && !licence.active) {
    throw new Error('System Alert Manager requires an active Marketplace licence to send communications.');
  }
}

function validatePriorities(rows) {
  if (rows == null) return;
  if (!Array.isArray(rows) || rows.length > 20) throw new Error('Configure no more than 20 alert priorities.');
  for (const row of rows) {
    assertLength(row?.name, 80, 'Priority name');
    assertLength(row?.label, 80, 'Priority display label');
    const color = text(row?.color);
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) throw new Error('Priority colour must be a six-digit hex colour.');
  }
}

function validateTemplates(payload = {}) {
  for (const type of ['initial', 'update', 'resolved', 'monthly-test']) {
    const item = payload?.[type];
    if (!item) continue;
    assertLength(item.subject, 500, `${type} subject`);
    assertLength(item.intro, 5000, `${type} introduction`);
    assertLength(item.followup, 5000, `${type} follow-up`);
    assertLength(item.sms, 1200, `${type} SMS template`);
  }
}

function validateAlertPayload(payload = {}, { requireChannels = false } = {}) {
  assertIssueKey(payload.issueKey);
  const alertType = text(payload.alertType || 'initial');
  if (!ALLOWED_ALERT_TYPES.has(alertType)) throw new Error('Invalid alert type.');
  assertLength(payload.clientCode, 100, 'Client code');
  assertLength(payload.summary, 500, 'Summary');
  assertLength(payload.message, 10000, 'Current situation');
  assertLength(payload.startTime, 200, 'Issue start time');
  assertLength(payload.nextUpdate, 200, 'Next update');

  if (payload.contactIds != null) {
    if (!Array.isArray(payload.contactIds) || payload.contactIds.length > 100) throw new Error('Select no more than 100 recipients at a time.');
    const unique = new Set();
    for (const id of payload.contactIds) {
      assertSafeId(id, 'contact ID');
      const key = text(id);
      if (unique.has(key)) throw new Error('Duplicate recipient selection detected.');
      unique.add(key);
    }
  }

  if (requireChannels) {
    if (payload.sendEmail !== true && payload.sendSms !== true) throw new Error('Choose Email, SMS, or both before sending.');
  }
}

function validateResolverPayload(key, payload = {}) {
  switch (key) {
    case 'getIssueAlertData':
      assertIssueKey(payload.issueKey);
      break;
    case 'previewEmail':
      validateAlertPayload(payload);
      break;
    case 'sendAlert':
      validateAlertPayload(payload, { requireChannels: true });
      if (!Array.isArray(payload.contactIds) || payload.contactIds.length === 0) throw new Error('Select at least one recipient.');
      break;
    case 'testEmailProvider':
      assertEmail(payload.recipient, 'Test recipient email address');
      if (!text(payload.recipient)) throw new Error('Enter a test recipient email address.');
      break;
    case 'saveContact':
      if (payload.id) assertSafeId(payload.id, 'contact ID');
      assertSafeId(payload.clientOptionId, 'client option ID');
      assertLength(payload.name, 120, 'Contact name');
      if (!text(payload.name)) throw new Error('Contact name is required.');
      assertEmail(payload.email);
      assertPhone(payload.mobile);
      if (payload.emailAlerts === true && !text(payload.email)) throw new Error('An email address is required when Email alerts are enabled.');
      if (payload.smsAlerts === true && !text(payload.mobile)) throw new Error('A mobile number is required when SMS alerts are enabled.');
      if (payload.priorities != null && (!Array.isArray(payload.priorities) || payload.priorities.length > 20)) throw new Error('Invalid contact priority selection.');
      break;
    case 'testContact':
    case 'deleteContact':
      assertSafeId(payload.id, 'contact ID');
      if (key === 'testContact' && !['email', 'sms'].includes(text(payload.channel))) throw new Error('Choose Email or SMS test.');
      break;
    case 'saveSettings':
      assertLength(payload.allowedProjectKey, 30, 'Project key');
      assertLength(payload.clientFieldId, 100, 'Client field ID');
      assertLength(payload.issueStartFieldId, 100, 'Issue Start Time field ID');
      assertLength(payload.nextUpdateFieldId, 100, 'Next Update Due field ID');
      assertLength(payload.fromName, 80, 'Sender display name');
      assertEmail(payload.replyToEmail, 'Reply-to email');
      validatePriorities(payload.priorityConfigs);
      if (payload.optionalFieldMappings != null && (!Array.isArray(payload.optionalFieldMappings) || payload.optionalFieldMappings.length > 20)) throw new Error('Configure no more than 20 additional incident fields.');
      break;
    case 'saveProviderSettings':
      assertEmail(payload.sendgridFromEmail, 'SendGrid sender email');
      assertEmail(payload.sendgridReplyToEmail, 'SendGrid reply-to email');
      assertEmail(payload.microsoftSenderMailbox, 'Microsoft sender mailbox');
      assertEmail(payload.microsoftReplyToEmail, 'Microsoft reply-to email');
      assertPhone(payload.twilioFromNumber, 'Twilio from number');
      for (const [field, max] of [['microsoftTenantId',100],['microsoftClientId',100],['twilioMessagingServiceSid',80],['sendgridFromName',80],['microsoftFromName',80]]) assertLength(payload[field], max, field);
      break;
    case 'saveMicrosoftMarketplaceSettings':
      assertLength(payload.microsoftTenantId, 100, 'Microsoft Tenant ID');
      assertEmail(payload.microsoftSenderMailbox, 'Microsoft sender mailbox');
      assertEmail(payload.microsoftReplyToEmail, 'Microsoft reply-to email');
      break;
    case 'saveTemplates':
      validateTemplates(payload);
      break;
    case 'saveBranding':
      assertLength(payload.serviceName, 80, 'Service name');
      assertLength(payload.logoUrl, 500, 'Logo URL');
      assertLength(payload.logoFileName, 120, 'Logo filename');
      assertLength(payload.footerText, 500, 'Footer text');
      assertLength(payload.supportLabel, 80, 'Support label');
      assertLength(payload.supportUrl, 500, 'Support URL');
      break;
    case 'previewTemplate':
      if (payload.template) validateTemplates({ [text(payload.templateType || 'initial')]: payload.template });
      break;
    default:
      break;
  }
}

async function requireJiraAdmin() {
  const response = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('Unable to verify Jira administrator permission.');
  const data = await response.json();
  if (data?.permissions?.ADMINISTER?.havePermission !== true) {
    throw new Error('Jira administrator permission is required for this System Alert Manager action.');
  }
}

const originalDefine = Resolver.prototype.define;
Resolver.prototype.define = function hardenedDefine(key, fn) {
  return originalDefine.call(this, key, async request => {
    validateResolverPayload(key, request?.payload || {});
    if (ADMIN_RESOLVERS.has(key)) await requireJiraAdmin();
    if (LICENSED_DELIVERY_RESOLVERS.has(key)) requireActiveLicence(request?.context || {});
    const result = await fn(request);
    if (key === 'getAdminData' && result && typeof result === 'object') {
      return { ...result, marketplaceLicence: licenceState(request?.context || {}) };
    }
    return result;
  });
};

const app = await import('./index.js');

export const handler = app.handler;

// Scheduled triggers do not pass through Resolver.define, so enforce the same
// production licence rule explicitly before a monthly test can send anything.
export async function monthlyTestScheduler(...args) {
  const appContext = getAppContext();
  const context = {
    environmentType: appContext?.environmentType,
    license: appContext?.license
  };
  const licence = licenceState(context);
  if (licence.enforced && !licence.active) {
    return { skipped: 'System Alert Manager Marketplace licence is inactive.' };
  }
  return app.monthlyTestScheduler(...args);
}
