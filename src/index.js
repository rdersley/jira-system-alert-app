import Resolver from '@forge/resolver';
import api, { route, fetch } from '@forge/api';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();
const CONTACT_INDEX = 'system-alert:contacts:index';
const SETTINGS_KEY = 'system-alert:settings';

const DEFAULT_SETTINGS = {
  clientFieldId: '',
  issueStartFieldId: 'customfield_10786',
  nextUpdateFieldId: 'customfield_10788',
  allowedProjectKey: 'SD',
  fromName: 'Service Desk',
  emailEnabled: true,
  smsEnabled: true,
  twilioRegion: 'global'
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
  return { ...DEFAULT_SETTINGS, ...((await kvs.get(SETTINGS_KEY)) || {}) };
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

  return { settings, contacts, appVersion: '3.3.2' };
});

resolver.define('saveSettings', async ({ payload }) => {
  const current = await getSettings();
  const next = { ...current, ...payload };
  await kvs.set(SETTINGS_KEY, next);
  return next;
});

resolver.define('saveContact', async ({ payload }) => {
  const id = payload.id || safeId();
  const contact = {
    id,
    clientCode: String(payload.clientCode || '').trim().toUpperCase(),
    clientName: String(payload.clientName || '').trim(),
    name: String(payload.name || '').trim(),
    email: normalizeTextValue(payload.email),
    mobile: normalizeTextValue(payload.mobile),
    priorities: normalizePriorities(payload.priorities),
    emailAlerts: payload.emailAlerts === true,
    smsAlerts: payload.smsAlerts === true,
    monthlyTestAlerts: payload.monthlyTestAlerts === true,
    active: payload.active !== false
  };
  if (!contact.clientCode || !contact.name) throw new Error('Client code and contact name are required.');
  await kvs.setSecret(`system-alert:contact:${id}`, contact);
  const ids = (await kvs.get(CONTACT_INDEX)) || [];
  if (!ids.includes(id)) await kvs.set(CONTACT_INDEX, [...ids, id]);
  return { ...contact, mobileMasked: maskPhone(contact.mobile) };
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

  const clientRaw = settings.clientFieldId ? fieldText(issue.fields[settings.clientFieldId]).toUpperCase() : '';
  const clientCode = clientRaw.includes(' - ') ? clientRaw.split(' - ')[0].trim() : clientRaw.trim();
  const priority = fieldText(issue.fields.priority) || '';
  if (!['P1','P2'].includes(priority.toUpperCase())) throw new Error('System Alert is only available for P1 or P2 tickets.');
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
  })).filter(c => c.active && c.clientCode === clientCode).map(c => ({
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
    clientCode,
    issueStartTime,
    nextUpdateDue,
    contacts,
    history,
    monthlyHistory,
    monthlyTestCompleted,
    monthlyTestMonth: monthLabel(),
    settings: { emailEnabled: settings.emailEnabled, smsEnabled: settings.smsEnabled, fromName: settings.fromName }
  };
});

function emailPresentation(a) {
  const isTest = a.alertType === 'monthly-test';
  const isResolved = a.alertType === 'resolved';
  const isUpdate = a.alertType === 'update';
  const priority = String(a.priority || 'P1').toUpperCase();

  if (isTest) return {
    eyebrow: 'SYSTEM ALERT TEST', badge: 'TEST ONLY', accent: '#B65C02', soft: '#FFF7D6', border: '#E2B203',
    title: 'Monthly System Alert Test', status: 'Scheduled test — no live service incident',
    intro: 'This is a scheduled test of the Service Desk System Alert service. There is no live service incident.'
  };
  if (isResolved) return {
    eyebrow: 'SERVICE STATUS', badge: 'SERVICE RESTORED', accent: '#216E4E', soft: '#DCFFF1', border: '#4BCE97',
    title: a.summary || 'Service restored', status: 'Resolved / service restored',
    intro: `The ${priority} incident has been resolved and service has been restored.`
  };
  if (priority === 'P2') return {
    eyebrow: isUpdate ? 'INCIDENT UPDATE' : 'SYSTEM ALERT', badge: isUpdate ? 'P2 UPDATE' : 'P2 SYSTEM ALERT',
    accent: '#B65C02', soft: '#FFF3E0', border: '#F5A623', title: a.summary || 'Priority 2 incident',
    status: isUpdate ? 'Incident update' : 'Investigation in progress',
    intro: isUpdate ? 'An update is available for this Priority 2 incident.' : 'A Priority 2 issue has been identified and our priority escalation process has been initiated.'
  };
  return {
    eyebrow: isUpdate ? 'INCIDENT UPDATE' : 'SYSTEM ALERT', badge: isUpdate ? 'P1 UPDATE' : 'P1 SYSTEM ALERT',
    accent: '#AE2E24', soft: '#FFECEB', border: '#E2483D', title: a.summary || 'Priority 1 incident',
    status: isUpdate ? 'Incident update' : 'Investigation in progress',
    intro: isUpdate ? 'An update is available for this Priority 1 incident.' : 'A Priority 1 issue has been identified and our priority escalation process has been initiated.'
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

function buildEmailSubject(a) {
  const summary = subjectSummary(a);
  if (a.alertType === 'monthly-test') return `TEST ONLY | MONTHLY SYSTEM ALERT TEST | ${a.clientCode} | ${a.testMonth || monthLabel()}`;
  if (a.alertType === 'resolved') return `SERVICE RESTORED | ${a.clientCode} | ${a.issueKey} | ${summary}`;
  if (a.alertType === 'update') return `${a.priority} UPDATE | ${a.clientCode} | ${a.issueKey} | ${summary}`;
  return `${a.priority} SYSTEM ALERT | ${a.clientCode} | ${a.issueKey} | ${summary}`;
}

function buildEmailText(a) {
  const p = emailPresentation(a);
  if (a.alertType === 'monthly-test') return `${buildEmailSubject(a)}\n\nTEST ONLY — NO LIVE SERVICE INCIDENT.\n\n${p.intro}\n\nReference: ${a.issueKey}\nCustomer: ${a.clientCode}\nTest month: ${a.testMonth || monthLabel()}\nStatus: ${p.status}\n\nTest details:\n${a.message}\n\nNo action is required unless acknowledgement is part of the agreed test process.`;
  return `${buildEmailSubject(a)}\n\n${p.intro}\n\nReference: ${a.issueKey}\nCustomer: ${a.clientCode}\nPriority: ${a.priority}\nIssue Start Time: ${a.startTime || 'Not specified'}\nNext Update Due: ${a.alertType === 'resolved' ? 'No further update planned' : (a.nextUpdate || 'To be confirmed')}\nStatus: ${p.status}\n\nCurrent situation:\n${a.message}\n\nPlease reference ${a.issueKey} in any correspondence regarding this incident.`;
}

function buildEmailHtml(a) {
  const p = emailPresentation(a);
  const isTest = a.alertType === 'monthly-test';
  const isResolved = a.alertType === 'resolved';
  const next = isResolved ? 'No further update planned' : (a.nextUpdate || 'To be confirmed');
  const fromName = a.fromName || 'Service Desk';
  const details = isTest
    ? [ ['Reference', a.issueKey], ['Customer', a.clientCode], ['Test month', a.testMonth || monthLabel()], ['Current status', p.status] ]
    : [ ['Reference', a.issueKey], ['Customer', a.clientCode], ['Priority', a.priority], ['Issue Start Time', a.startTime || 'Not specified'], ['Next Update Due', next], ['Current status', p.status] ];
  const rows = details.map(([k,v],i) => {
    const borderStyle = i < details.length - 1 ? 'border-bottom:1px solid #EBECF0;' : '';
    const valueHtml = k === 'Priority'
      ? `<span style="display:inline-block;background:${p.accent};color:#FFFFFF;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700">${esc(v)}</span>`
      : esc(v);
    return `<tr><td style="width:34%;padding:11px 14px;color:#626f86;font-size:13px;${borderStyle}">${esc(k)}</td><td style="padding:11px 14px;color:#172B4D;font-size:13px;font-weight:700;${borderStyle}">${valueHtml}</td></tr>`;
  }).join('');
  const alertBox = isTest ? `<tr><td style="padding:0 32px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.soft};border:1px solid ${p.border};border-radius:8px"><tr><td style="padding:15px 17px;color:#533F04;font-size:14px;line-height:1.5"><strong>TEST ONLY — NO LIVE SERVICE INCIDENT</strong><br>This message is part of the scheduled monthly System Alert test.</td></tr></table></td></tr>` : '';
  const followup = isTest ? 'No action is required unless acknowledgement is part of the agreed test process.' : isResolved ? 'No further incident updates are planned at this time. The Service Desk will continue to monitor the service.' : 'Our support team is actively managing this incident. A further update will be provided by the time shown above, or sooner if there is a significant change.';

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F1F2F4;font-family:Arial,Helvetica,sans-serif;color:#172B4D"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F2F4"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#FFFFFF;border:1px solid #DFE1E6;border-radius:12px;overflow:hidden"><tr><td style="background:#172B4D;padding:25px 32px"><div style="font-size:12px;line-height:1.2;letter-spacing:1.5px;font-weight:700;color:#B3B9C4">${esc(fromName.toUpperCase())}</div><div style="margin-top:8px;font-size:25px;line-height:1.25;font-weight:700;color:#FFFFFF">${esc(p.title)}</div></td></tr><tr><td style="padding:24px 32px 14px"><div style="display:inline-block;background:${p.accent};color:#FFFFFF;border-radius:5px;padding:9px 14px;font-size:13px;line-height:1.2;font-weight:700;letter-spacing:.3px">${esc(p.badge)}</div><div style="margin-top:18px;font-size:15px;line-height:1.6;color:#172B4D">${esc(p.intro)}</div></td></tr>${alertBox}<tr><td style="padding:4px 32px 20px"><div style="font-size:16px;font-weight:700;margin-bottom:10px">Incident details</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DFE1E6;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden">${rows}</table></td></tr><tr><td style="padding:0 32px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.soft};border-left:4px solid ${p.accent};border-radius:6px"><tr><td style="padding:17px 18px"><div style="font-size:16px;font-weight:700;margin-bottom:9px">${isTest?'Test details':'Current situation'}</div><div style="font-size:14px;line-height:1.65;white-space:pre-line">${esc(a.message || '')}</div></td></tr></table><div style="font-size:14px;line-height:1.6;margin-top:20px">${esc(followup)}</div></td></tr><tr><td style="background:#F7F8F9;border-top:1px solid #EBECF0;padding:19px 32px;color:#626F86;font-size:12px;line-height:1.55"><strong style="color:#44546F">${esc(fromName)}</strong><br>${isTest ? `Scheduled System Alert test · Reference ${esc(a.issueKey)}` : `Please reference ${esc(a.issueKey)} in any correspondence regarding this incident.`}</td></tr></table></td></tr></table></body></html>`;
}

function buildSmsText(a) {
  const issueText = (a.message || a.summary || '').trim();
  const start = a.startTime || 'Not specified';
  const next = a.nextUpdate || 'To be confirmed';

  if (a.alertType === 'monthly-test') {
    return `Hi,\n\nThis is the scheduled monthly System Alert test for ${a.clientCode}.\n\nThere is no live service incident.\n\nTest Month: ${a.testMonth || monthLabel()}\nReference: ${a.issueKey}\n\nNo action is required unless acknowledgement is part of the agreed test process.\n\nMany Thanks`.slice(0, 700);
  }

  if (a.alertType === 'resolved') {
    return `Hi,\n\nThe ${a.priority} issue has now been resolved.\n\nIssue Start Time: ${start}\n\nIssue: ${issueText}\n\nService Status: Restored\n\nNo further updates are planned at this time.\n\nMany Thanks`.slice(0, 700);
  }

  if (a.alertType === 'update') {
    return `Hi,\n\nAn update is available for the ${a.priority} issue.\n\nIssue Start Time: ${start}\n\nIssue: ${issueText}\n\nNext Update Due: ${next}\n\nOur priority escalation process remains active and a further update will follow shortly.\n\nMany Thanks`.slice(0, 700);
  }

  return `Hi,\n\nA ${a.priority} issue has been identified.\n\nIssue Start Time: ${start}\n\nIssue: ${issueText}\n\nNext Update Due: ${next}\n\nOur priority escalation process has started and a further update will follow shortly.\n\nMany Thanks`.slice(0, 700);
}

async function sendTwilio(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const username = process.env.TWILIO_API_KEY || accountSid;
  const password = process.env.TWILIO_API_SECRET || process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !username || !password) throw new Error('Twilio credentials are not configured.');
  const region = process.env.TWILIO_REGION === 'ie1' ? 'https://api.dublin.ie1.twilio.com' : 'https://api.twilio.com';
  const params = new URLSearchParams({ To: to, Body: body });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  else if (process.env.TWILIO_FROM_NUMBER) params.set('From', process.env.TWILIO_FROM_NUMBER);
  else throw new Error('Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.');
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

async function sendEmail(toEmails, subject, html, text, fromName) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.ALERT_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new Error('Email provider is not configured. Set SENDGRID_API_KEY and ALERT_FROM_EMAIL.');
  const body = {
    personalizations: [{ to: [{ email: fromEmail }], bcc: toEmails.map(email => ({ email })) }],
    from: { email: fromEmail, name: process.env.ALERT_FROM_NAME || fromName || 'Service Desk' },
    subject,
    content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }]
  };
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
  if (settings.issueStartFieldId) fields.push(settings.issueStartFieldId);
  if (settings.nextUpdateFieldId) fields.push(settings.nextUpdateFieldId);
  const check = await api.asUser().requestJira(route`/rest/api/3/issue/${payload.issueKey}?fields=${fields.join(',')}`);
  if (!check.ok) throw new Error(`Could not validate Jira issue (${check.status}).`);
  const currentIssue = await check.json();
  const currentProject = currentIssue.fields.project?.key || '';
  const currentPriority = fieldText(currentIssue.fields.priority).toUpperCase();
  if (settings.allowedProjectKey && currentProject !== settings.allowedProjectKey) throw new Error('System Alert is not enabled for this project.');
  if (!['P1','P2'].includes(currentPriority)) throw new Error('System Alert can only be previewed from a P1 or P2 ticket.');

  // Prefer values currently entered in the alert form. If either field is empty,
  // fall back to the configured Jira custom field so the preview always matches the ticket.
  const startTime = payload.startTime || (settings.issueStartFieldId ? formatDateTime(fieldText(currentIssue.fields[settings.issueStartFieldId])) : '');
  const nextUpdate = payload.nextUpdate || (settings.nextUpdateFieldId ? formatDateTime(fieldText(currentIssue.fields[settings.nextUpdateFieldId])) : '');
  const a = { ...payload, startTime, nextUpdate, priority: currentPriority, fromName: settings.fromName, testMonth: payload.testMonth || monthLabel() };
  const presentation = emailPresentation(a);
  return {
    subject: buildEmailSubject(a),
    html: buildEmailHtml(a),
    text: buildEmailText(a),
    model: {
      issueKey: a.issueKey,
      clientCode: a.clientCode,
      priority: a.priority,
      summary: a.summary,
      alertType: a.alertType,
      startTime: a.startTime,
      nextUpdate: a.nextUpdate,
      message: a.message,
      testMonth: a.testMonth,
      fromName: a.fromName,
      presentation
    }
  };
});

resolver.define('sendAlert', async ({ payload, context }) => {
  const settings = await getSettings();
  const check = await api.asUser().requestJira(route`/rest/api/3/issue/${payload.issueKey}?fields=priority,project`);
  if (!check.ok) throw new Error(`Could not validate Jira issue (${check.status}).`);
  const currentIssue = await check.json();
  const currentProject = currentIssue.fields.project?.key || '';
  const currentPriority = fieldText(currentIssue.fields.priority).toUpperCase();
  if (settings.allowedProjectKey && currentProject !== settings.allowedProjectKey) throw new Error('System Alert is not enabled for this project.');
  if (!['P1','P2'].includes(currentPriority)) throw new Error('System Alert can only be sent from a P1 or P2 ticket.');
  payload.priority = currentPriority;
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

  const isTest = payload.alertType === 'monthly-test';
  const eligibleContacts = contacts.filter(c => isTest ? c.monthlyTestAlerts === true : (Array.isArray(c.priorities) ? c.priorities : ['P1']).includes(payload.priority));
  if (!eligibleContacts.length) throw new Error(isTest ? 'None of the selected contacts are enabled for Monthly Test alerts.' : `None of the selected contacts are enabled for ${payload.priority} alerts.`);

  const a = { ...payload, fromName: settings.fromName, testMonth: payload.testMonth || monthLabel() };
  const subject = buildEmailSubject(a);
  const text = buildEmailText(a);
  const html = buildEmailHtml(a);

  const emailRecipients = payload.sendEmail
    ? [...new Set(eligibleContacts.filter(c => c.email && (isTest || c.emailAlerts)).map(c => c.email))]
    : [];
  const smsRecipients = payload.sendSms
    ? [...new Set(eligibleContacts.filter(c => c.mobile && (isTest || c.smsAlerts)).map(c => c.mobile))]
    : [];
  if (!emailRecipients.length && !smsRecipients.length) throw new Error('The selected recipients do not have an enabled email or SMS destination for this alert.');

  const results = { email: { attempted: emailRecipients.length, ok: false }, sms: { attempted: smsRecipients.length, sent: 0, failed: [] } };
  if (emailRecipients.length) {
    await sendEmail(emailRecipients, subject, html, text, settings.fromName);
    results.email.ok = true;
  }

  const smsText = buildSmsText(a);

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

export const handler = resolver.getDefinitions();
