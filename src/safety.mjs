export const textValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (typeof v === 'object') return String(v.value ?? v.label ?? v.name ?? v.displayName ?? '').trim();
  return String(v).trim();
};

export const priorityKey = (value='') => textValue(value).toUpperCase();

export const contactMatchesClient = (contact, clientCode) =>
  priorityKey(contact?.clientCode) === priorityKey(clientCode);

export function selectEligibleContacts(contacts = [], { clientCode, priority, alertType = 'initial' } = {}) {
  const isTest = alertType === 'monthly-test';
  return contacts.filter(c => {
    if (!c || c.active === false || !contactMatchesClient(c, clientCode)) return false;
    if (isTest) return c.monthlyTestAlerts === true;
    const priorities = Array.isArray(c.priorities) ? c.priorities : (c.priorities ? [c.priorities] : []);
    return priorities.some(p => priorityKey(p) === priorityKey(priority));
  });
}

export function uniqueDeliveryTargets(contacts = [], channel = 'email') {
  const values = channel === 'sms'
    ? contacts.filter(c => c.smsAlerts && c.mobile).map(c => textValue(c.mobile))
    : contacts.filter(c => c.emailAlerts && c.email).map(c => textValue(c.email).toLowerCase());
  return [...new Set(values.filter(Boolean))];
}

export function renderTokens(template = '', context = {}) {
  return String(template).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => String(context[String(key).trim()] ?? ''));
}

export function monthKeyUtc(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}

export function shouldRunMonthlyTest({ enabled = true, currentHour, targetHour = 10, alreadySent = false } = {}) {
  return enabled !== false && Number(currentHour) === Number(targetHour) && !alreadySent;
}
