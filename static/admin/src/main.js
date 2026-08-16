import { invoke } from '@forge/bridge';
import './styles.css';

const APP_VERSION = '3.3.2';
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
        <div><h2>App settings</h2><p>System Alert is restricted to SD tickets with priority P1 or P2. These Jira fields pre-fill the alert.</p></div>
      </div>
      <form id="settingsForm" class="card-body form-grid">
        ${field('clientFieldId','Client Jira field ID', settings.clientFieldId || '', 'customfield_10115')}
        ${field('issueStartFieldId','Issue Start Time field ID', settings.issueStartFieldId || 'customfield_10786', 'customfield_10786')}
        ${field('nextUpdateFieldId','Next Update Due field ID', settings.nextUpdateFieldId || 'customfield_10788', 'customfield_10788')}
        ${field('allowedProjectKey','Allowed project', settings.allowedProjectKey || 'SD', 'SD')}
        ${field('fromName','Sender display name', settings.fromName || 'Service Desk', 'Service Desk', 'wide')}
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
          <label><input id="priorityP1" type="checkbox" ${checked((c.priorities || []).includes('P1'))}> P1</label>
          <label><input id="priorityP2" type="checkbox" ${checked((c.priorities || []).includes('P2'))}> P2</label>
        </div></div>
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
      <div class="card-head"><div><h2>Current contacts</h2><p>${contacts.length} saved contact${contacts.length === 1 ? '' : 's'}.</p></div></div>
      <div class="contacts">
        ${contacts.length ? contacts.map(contactCard).join('') : `<div class="empty">No contacts have been added yet.</div>`}
      </div>
    </section>
  </div>`;

  bindEvents();
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
        fromName: getValue('fromName')
      });
      state.message = 'Settings saved.';
      await load();
    });
  };

  byId('contactForm').onsubmit = async e => {
    e.preventDefault();
    const editing = state.editingId;
    await act(async () => {
      const priorities = [];
      if (byId('priorityP1').checked) priorities.push('P1');
      if (byId('priorityP2').checked) priorities.push('P2');
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
