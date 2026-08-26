const draft = {
  active: false,
  values: null
};

function contactForm() {
  return document.getElementById('contactForm');
}

function normalizePhone(value = '') {
  let raw = String(value || '').trim();
  if (!raw) return '';

  // Copying from Outlook, Teams, Excel and address books can introduce NBSP,
  // Unicode dashes and other formatting. Convert those safely before checking.
  raw = raw.normalize('NFKC').replace(/\u00A0/g, ' ');
  const hadLeadingPlus = /^\s*\+/.test(raw);
  const digits = raw.replace(/\D/g, '');
  let v = hadLeadingPlus ? `+${digits}` : digits;

  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (/^\+3530[1-9]/.test(v)) v = `+353${v.slice(5)}`;
  if (/^0[1-9][0-9]{7,9}$/.test(v)) v = `+353${v.slice(1)}`;

  return v;
}

function readDraft(form = contactForm()) {
  if (!form) return null;
  return {
    clientOptionId: form.querySelector('#clientOptionId')?.value || '',
    name: form.querySelector('#name')?.value || '',
    email: form.querySelector('#email')?.value || '',
    mobile: form.querySelector('#mobile')?.value || '',
    priorities: [...form.querySelectorAll('.contact-priority:checked')].map(el => el.dataset.priority || ''),
    emailAlerts: Boolean(form.querySelector('#emailAlerts')?.checked),
    smsAlerts: Boolean(form.querySelector('#smsAlerts')?.checked),
    monthlyTestAlerts: Boolean(form.querySelector('#monthlyTestAlerts')?.checked)
  };
}

function writeDraft(form, values) {
  if (!form || !values) return;
  const setValue = (selector, value) => {
    const el = form.querySelector(selector);
    if (el) el.value = value ?? '';
  };
  setValue('#clientOptionId', values.clientOptionId);
  setValue('#name', values.name);
  setValue('#email', values.email);
  setValue('#mobile', values.mobile);

  const selected = new Set(values.priorities || []);
  form.querySelectorAll('.contact-priority').forEach(el => {
    el.checked = selected.has(el.dataset.priority || '');
  });
  const setChecked = (selector, value) => {
    const el = form.querySelector(selector);
    if (el) el.checked = Boolean(value);
  };
  setChecked('#emailAlerts', values.emailAlerts);
  setChecked('#smsAlerts', values.smsAlerts);
  setChecked('#monthlyTestAlerts', values.monthlyTestAlerts);
}

function showContactError(message) {
  document.querySelectorAll('.contact-guard-error').forEach(el => el.remove());
  const form = contactForm();
  if (!form) return;
  const box = document.createElement('div');
  box.className = 'notice error contact-guard-error wide';
  box.setAttribute('role', 'alert');
  box.textContent = message;
  form.prepend(box);
}

function clearContactError() {
  document.querySelectorAll('.contact-guard-error').forEach(el => el.remove());
}

// Capture values continuously so a Forge/backend validation error cannot wipe
// an unsaved contact when main.js re-renders the admin page.
document.addEventListener('input', event => {
  if (!event.target?.closest?.('#contactForm')) return;
  draft.active = true;
  draft.values = readDraft();
}, true);

document.addEventListener('change', event => {
  if (!event.target?.closest?.('#contactForm')) return;
  draft.active = true;
  draft.values = readDraft();
}, true);

// Run before main.js's submit handler. Normalize common Irish formats and stop
// an invalid number locally, preserving every field for correction.
document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'contactForm') return;

  clearContactError();
  const mobile = form.querySelector('#mobile');
  if (mobile) {
    const normalized = normalizePhone(mobile.value);
    mobile.value = normalized;
    if (normalized && !/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
      draft.active = true;
      draft.values = readDraft(form);
      event.preventDefault();
      event.stopImmediatePropagation();
      showContactError('Mobile number is not valid. Use an international number such as +353871234567, or an Irish number such as 0871234567. Your entered contact details have been kept.');
      mobile.focus();
      return;
    }
  }

  draft.active = true;
  draft.values = readDraft(form);
}, true);

const observer = new MutationObserver(() => {
  const savedNotice = [...document.querySelectorAll('.notice.success')].some(el => /Contact (saved|updated)\./i.test(el.textContent || ''));
  if (savedNotice) {
    draft.active = false;
    draft.values = null;
    return;
  }

  const form = contactForm();
  if (form && draft.active && draft.values) writeDraft(form, draft.values);
});

observer.observe(document.documentElement, { childList: true, subtree: true });
