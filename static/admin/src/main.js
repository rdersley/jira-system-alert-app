import { invoke } from '@forge/bridge';
import './styles.css';

const APP_VERSION = '3.6.0';
const app = document.querySelector('#app');

const state = {
  data: null,
  editingId: null,
  message: '',
  error: '',
  busy: false
};

const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
const checked = v => v ? 'checked' : '';

function maskEmail(email='') {
  if (!email) return 'No email';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return `${email.slice(0,1)}••••${email.slice(at)}`;
}

function renderLoading() {
  app.innerHTML = `<div class="page"><div class="loading"><span class="spinner"></span> Loading System Alert contacts…</div></div>`;
}

function render() {
  if (!state.data) return renderLoading();
  const { settings = {}, contacts = [] } = state.data;
  const editing = state.editingId ? contacts.find(c => c.id === state.editingId) : null;
  const c = editing || {};

  app.innerHTML = `<div class="page">
    <header class="hero">
      <div>
        <h1>System Alert Contacts</h1>
        <p>Manage System Alert settings and client notification contacts.</p>
      </div>
      <span class="version">v${esc(state.data.appVersion || APP_VERSION)}</span>
    </header>

    ${state.message ? `<div class="notice success">${esc(state.message)}</div>` : ''}
    ${state.error ? `<div class="notice error">${esc(state.error)}</div>` : ''}

    <section class="card">
      <div class="card-head">
        <div><h2>App settings</h2><p>Choose the Jira project and priorities that can use System Alert. These Jira fields pre-fill the alert.</p></div>
      </div>
      <form id="settingsForm" class="card-body form-grid">
        ${field('clientFieldId','Client Jira field ID', settings.clientFieldId || '', 'customfield_10115')}
        ${field('issueStartFieldId','Issue Start Time field ID', settings.issueStartFieldId || 'customfield_10786', 'customfield_10786')}
        ${field('nextUpdateFieldId','Next Update Due field ID', settings.nextUpdateFieldId || 'customfield_10788', 'customfield_10788')}
        ${field('allowedProjectKey','Allowed project', settings.allowedProjectKey || 'SD', 'SD')}
        ${field('fromName','Sender display name', settings.fromName || 'Service Desk', 'Service Desk')}
        ${field('replyToEmail','Reply-to email', settings.replyToEmail || '', 'servicedesk@example.com','', 'email')}
        <div class="field wide"><label>System Alert priorities</label><p class="help">Add the Jira priority names that should show the System Alert button. Names must match Jira exactly. You can also set the label and colour used in notifications.</p><div id="priorityConfigRows" class="priority-config-list">${renderPriorityConfigRows(settings.priorityConfigs || [])}</div><button id="addPriority" class="btn secondary small" type="button">+ Add priority</button></div>
        <div class="field wide"><label>Automatic monthly test</label><div class="checks inline-checks">
          <label><input id="monthlyTestEnabled" type="checkbox" ${checked(settings.monthlyTestEnabled !== false)}> Enabled</label>
          <label>Run from <select id="monthlyTestHour">${Array.from({length:24},(_,h)=>`<option value="${h}" ${Number(settings.monthlyTestHour ?? 10)===h?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')} </select> Ireland time on the first Wednesday</label>
        </div><p class="help">Forge checks hourly. The test sends on the first hourly run at or after this time, once per client.</p></div>
        <div class="form-actions wide"><button class="btn primary" type="submit">Save settings</button></div>
      </form>
    </section>

    <section class="card ${editing ? 'editing' : ''}">
      <div class="card-head">
        <div><h2>${editing ? 'Edit contact' : 'Add contact'}</h2><p>${editing ? 'Update the saved contact details and alert preferences.' : 'Add a contact or distribution list for a client.'}</p></div>
        ${editing ? `<button id="cancelEditTop" class="btn secondary" type="button">Cancel edit</button>` : ''}
      </div>
      <form id="contactForm" class="card-body form-grid">
        ${field('clientCode','Client code', c.clientCode || '', 'RYR')}
        ${field('clientName','Client name', c.clientName || '', 'Ryanair')}
        ${field('name','Contact / distribution list name', c.name || '', 'Operations Team','wide')}
        ${field('email','Email address', c.email || '', 'name@example.com','', 'email')}
        ${field('mobile','Mobile number', c.mobile || '', '+353...')}
        <div class="field wide"><label>Live incident priorities</label><div class="priority-options">
          ${renderContactPriorityOptions(c.priorities || [], settings.priorityConfigs || [])}
        </div><p class="help">Only priorities enabled above can be assigned to contacts.</p></div>
        <div class="checks wide">
          <label><input id="emailAlerts" type="checkbox" ${checked(c.emailAlerts === true)}> Receive email alerts</label>
          <label><input id="smsAlerts" type="checkbox" ${checked(c.smsAlerts === true)}> Receive SMS alerts</label>
          <label><input id="monthlyTestAlerts" type="checkbox" ${checked(c.monthlyTestAlerts === true)}> Receive Monthly System Alert Test</label>
        </div>
        <div class="form-actions wide">
          ${editing ? `<button id="cancelEdit" class="btn secondary" type="button">Cancel</button>` : ''}
          <button class="btn primary" type="submit">${editing ? 'Save changes' : 'Add contact'}</button>
        </div>
      </form>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Automatic monthly test</h2><p>First Wednesday of each month. Recipient lists remain isolated by client code.</p></div></div>
      <div class="card-body">${renderAutoTestStatus(state.data.autoTestStatus)}</div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Current contacts</h2><p>${contacts.length} saved contact${contacts.length === 1 ? '' : 's'}.</p></div></div>
      <div class="contacts">
        ${contacts.length ? contacts.map(contactCard).join('') : `<div class="empty">No contacts have been added yet.</div>`}
      </div>
    </section>
  </div>`;

  bindEvents();
}

function renderPriorityConfigRows(configs = []) {
  const rows = configs.length ? configs : [
    { name: 'P1', label: 'P1', color: '#AE2E24' },
    { name: 'P2', label: 'P2', color: '#B65C02' }
  ];
  return rows.map((p, i) => `<div class="priority-config-row" data-priority-row>
    <div class="field compact"><label>Jira priority name</label><input class="priority-name" value="${esc(p.name || '')}" placeholder="e.g. Highest"></div>
    <div class="field compact"><label>Display label</label><input class="priority-label" value="${esc(p.label || p.name || '')}" placeholder="e.g. P1 / Critical"></div>
    <div class="field compact color-field"><label>Colour</label><input class="priority-color" type="color" value="${esc(p.color || '#0C66E4')}"></div>
    <button class="btn danger small remove-priority" type="button" ${rows.length <= 1 ? 'disabled' : ''}>Remove</button>
  </div>`).join('');
}

function renderContactPriorityOptions(selected = [], configs = []) {
  const selectedKeys = new Set(selected.map(x => String(x).toUpperCase()));
  if (!configs.length) return '<span class="muted">Save at least one System Alert priority first.</span>';
  return configs.map((p, i) => `<label><input class="contact-priority" type="checkbox" data-priority="${esc(p.name)}" ${checked(selectedKeys.has(String(p.name).toUpperCase()))}> <span class="priority-dot" style="background:${esc(p.color || '#0C66E4')}"></span>${esc(p.label || p.name)} <small>(${esc(p.name)})</small></label>`).join('');
}

function collectPriorityConfigs() {
  const rows = [...document.querySelectorAll('[data-priority-row]')];
  const configs = rows.map(row => ({
    name: row.querySelector('.priority-name')?.value?.trim() || '',
    label: row.querySelector('.priority-label')?.value?.trim() || '',
    color: row.querySelector('.priority-color')?.value || '#0C66E4'
  })).filter(p => p.name);
  const seen = new Set();
  return configs.filter(p => { const key=p.name.toUpperCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}

function renderAutoTestStatus(status = {}) {
  if (status.enabled === false) return '<div class="empty">Automatic monthly testing is currently disabled.</div>';
  const clients = status.clients || [];
  if (!clients.length) return `<div class="empty">Enabled for the first Wednesday from ${String(status.hour ?? 10).padStart(2,'0')}:00 Ireland time. No contacts are currently enabled for Monthly Test.</div>`;
  return `<div class="status-list">${clients.map(row => {
    const last = row.last;
    const lastText = last ? `${last.monthLabel || ''} · ${last.automatic ? 'Automatic' : 'Manual'} · Email ${last.emailCount ?? 0} · SMS ${last.smsCount ?? 0}` : 'No monthly test recorded yet';
    return `<div class="status-row"><strong>${esc(row.clientCode)}</strong><span>${esc(lastText)}</span></div>`;
  }).join('')}</div>`;
}

function field(id, label, value, placeholder='', extra='', type='text') {
  return `<div class="field ${extra}"><label for="${id}">${esc(label)}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`;
}

function contactCard(c) {
  const flags = [];
  if ((c.priorities || []).length) flags.push(`Live: ${(c.priorities || []).join(', ')}`); else flags.push('Live: None');
  if (c.emailAlerts) flags.push('Email');
  if (c.smsAlerts) flags.push('SMS');
  if (c.monthlyTestAlerts) flags.push('Monthly Test');
  return `<article class="contact-card">
    <div class="contact-main">
      <div><h3>${esc(c.clientCode)} — ${esc(c.name)}</h3><p>${esc(c.clientName || '')}</p></div>
      <div class="contact-info"><span>${esc(maskEmail(c.email))}</span><span>${esc(c.mobileMasked || 'No mobile')}</span></div>
      <div class="badges">${flags.map(f => `<span class="badge">${esc(f)}</span>`).join('')}</div>
    </div>
    <div class="contact-actions">
      <button class="btn secondary edit-contact" data-id="${esc(c.id)}" type="button">Edit</button>
      <button class="btn danger delete-contact" data-id="${esc(c.id)}" type="button">Delete</button>
    </div>
  </article>`;
}

function bindPriorityRowButtons() {
  document.querySelectorAll('.remove-priority').forEach(btn => btn.onclick = () => {
    const rows = document.querySelectorAll('[data-priority-row]');
    if (rows.length <= 1) return;
    btn.closest('[data-priority-row]')?.remove();
    document.querySelectorAll('.remove-priority').forEach(b => b.disabled = document.querySelectorAll('[data-priority-row]').length <= 1);
  });
}

function getValue(id) { return byId(id)?.value?.trim() || ''; }

function bindEvents() {
  byId('settingsForm').onsubmit = async e => {
    e.preventDefault();
    await act(async () => {
      await invoke('saveSettings', {
        clientFieldId: getValue('clientFieldId'),
        issueStartFieldId: getValue('issueStartFieldId'),
        nextUpdateFieldId: getValue('nextUpdateFieldId'),
        allowedProjectKey: getValue('allowedProjectKey'),
        fromName: getValue('fromName'),
        replyToEmail: getValue('replyToEmail'),
        priorityConfigs: collectPriorityConfigs(),
        monthlyTestEnabled: byId('monthlyTestEnabled').checked,
        monthlyTestHour: Number(byId('monthlyTestHour').value)
      });
      state.message = 'Settings saved.';
      await load();
    });
  };

  byId('addPriority').onclick = () => {
    const host = byId('priorityConfigRows');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPriorityConfigRows([{ name:'', label:'', color:'#0C66E4' }]);
    const row = wrapper.firstElementChild;
    host.appendChild(row);
    bindPriorityRowButtons();
  };
  bindPriorityRowButtons();

  byId('contactForm').onsubmit = async e => {
    e.preventDefault();
    const editing = state.editingId;
    await act(async () => {
      const priorities = [...document.querySelectorAll('.contact-priority:checked')].map(cb => cb.dataset.priority).filter(Boolean);
      await invoke('saveContact', {
        id: editing || undefined,
        clientCode: getValue('clientCode'),
        clientName: getValue('clientName'),
        name: getValue('name'),
        email: getValue('email'),
        mobile: getValue('mobile'),
        priorities,
        emailAlerts: byId('emailAlerts').checked,
        smsAlerts: byId('smsAlerts').checked,
        monthlyTestAlerts: byId('monthlyTestAlerts').checked
      });
      state.editingId = null;
      state.message = editing ? 'Contact updated.' : 'Contact saved.';
      await load();
    });
  };

  document.querySelectorAll('.edit-contact').forEach(btn => btn.onclick = () => {
    state.editingId = btn.dataset.id;
    state.message = '';
    state.error = '';
    render();
    window.scrollTo({ top: document.querySelector('.editing')?.offsetTop || 0, behavior: 'smooth' });
  });

  document.querySelectorAll('.delete-contact').forEach(btn => btn.onclick = async () => {
    const contact = state.data.contacts.find(c => c.id === btn.dataset.id);
    if (!confirm(`Delete ${contact?.name || 'this contact'}?`)) return;
    await act(async () => {
      await invoke('deleteContact', { id: btn.dataset.id });
      if (state.editingId === btn.dataset.id) state.editingId = null;
      state.message = 'Contact deleted.';
      await load();
    });
  });

  const cancel = () => { state.editingId = null; state.message = ''; state.error=''; render(); };
  if (byId('cancelEdit')) byId('cancelEdit').onclick = cancel;
  if (byId('cancelEditTop')) byId('cancelEditTop').onclick = cancel;
}

async function act(fn) {
  if (state.busy) return;
  state.busy = true;
  state.error = '';
  try { await fn(); }
  catch (e) { state.error = e?.message || String(e); render(); }
  finally { state.busy = false; }
}

async function load() {
  state.data = await invoke('getAdminData');
  render();
}

renderLoading();
load().catch(e => { state.error = e?.message || String(e); app.innerHTML = `<div class="page"><div class="notice error">${esc(state.error)}</div></div>`; });
