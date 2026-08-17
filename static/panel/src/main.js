import { invoke, view, Modal } from '@forge/bridge';
import './styles.css';

const APP_VERSION = '3.7.8';
const app = document.querySelector('#app');
let state = { context: null, data: null, error: '', loading: true };

const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function issueKeyFromContext(ctx) {
  return ctx?.extension?.issue?.key || ctx?.platformContext?.issueKey || ctx?.extension?.issueKey || '';
}

function typeLabel(type='') {
  return ({initial:'Initial alert', update:'Incident update', resolved:'Service restored', 'monthly-test':'Monthly test'})[type] || type || 'Alert';
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IE', { dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Dublin' }).format(new Date(iso));
  } catch { return iso; }
}

function eligibleContacts() {
  const p = String(state.data?.priority || '').toUpperCase();
  return (state.data?.contacts || []).filter(c => (c.priorities || []).map(x=>String(x).toUpperCase()).includes(p));
}

function renderLoading() {
  app.innerHTML = `<div class="panel shell"><div class="loading"><span class="spinner"></span> Loading System Alert…</div></div>`;
}

function renderError(message) {
  app.innerHTML = `<div class="panel shell"><div class="panel-head"><div><h2>System Alert</h2><p>Incident communications</p></div><span class="version">v${APP_VERSION}</span></div><div class="notice error">${esc(message)}</div></div>`;
}

function renderHistory(history=[]) {
  if (!history.length) return `<div class="empty">No System Alert communications have been sent for this ticket yet.</div>`;
  return `<div class="timeline">${history.slice(0,5).map(h => `<div class="timeline-row"><div class="dot"></div><div class="timeline-main"><strong>${esc(typeLabel(h.alertType))}</strong><span>${esc(formatWhen(h.at))}</span></div><div class="timeline-counts"><span>✉ ${Number(h.emailCount||0)}</span><span>SMS ${Number(h.smsCount||0)}</span></div></div>`).join('')}</div>`;
}

function render() {
  const d = state.data;
  if (!d) return renderError(state.error || 'Ticket data is unavailable.');
  const eligible = eligibleContacts();
  const last = d.history?.[0];
  const next = d.nextUpdateDue || 'Not set';

  app.innerHTML = `<div class="panel shell">
    <div class="panel-head">
      <div><h2>System Alert</h2><p>Customer incident communications</p></div>
      <span class="version">v${APP_VERSION}</span>
    </div>
    ${state.error ? `<div class="notice error">${esc(state.error)}</div>` : ''}
    <div class="status-grid">
      <div class="status"><span>Client</span><strong>${esc(d.clientCode || 'Not set')}</strong></div>
      <div class="status"><span>Priority</span><strong class="priority" style="background:${esc(d.priorityColor || '#0C66E4')};color:#fff">${esc(d.priorityLabel || d.priority)}</strong></div>
      <div class="status"><span>Eligible contacts</span><strong>${eligible.length}</strong></div>
      <div class="status"><span>Next update</span><strong>${esc(next)}</strong></div>
    </div>
    <div class="issue-title">${esc(d.summary || d.issueKey)}</div>
    <div class="primary-row">
      <button id="sendAlert" class="send-btn">Send System Alert</button>
      <div class="last-alert">${last ? `Last communication: <strong>${esc(typeLabel(last.alertType))}</strong> · ${esc(formatWhen(last.at))}` : 'No alert has been sent yet.'}</div>
    </div>
    <div class="history-head"><h3>Communication history</h3><span>${(d.history || []).length} recorded</span></div>
    ${renderHistory(d.history)}
  </div>`;

  document.querySelector('#sendAlert').onclick = openAlert;
}

async function openAlert() {
  const issueKey = state.data?.issueKey;
  const modal = new Modal({
    resource: 'alert-ui-custom',
    size: 'xlarge',
    title: 'Send System Alert',
    context: { issueKey },
    onClose: async () => { await load(); }
  });
  await modal.open();
}

async function load() {
  state.loading = true;
  renderLoading();
  try {
    state.context = await view.getContext();
    const issueKey = issueKeyFromContext(state.context);
    if (!issueKey) throw new Error('Could not determine the Jira issue key.');
    state.data = await invoke('getIssueAlertData', { issueKey });
    state.error = '';
    render();
  } catch (e) {
    state.error = e?.message || String(e);
    renderError(state.error);
  } finally {
    state.loading = false;
  }
}

load();
