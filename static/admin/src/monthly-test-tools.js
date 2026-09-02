import { invoke } from '@forge/bridge';
import './monthly-test-tools.css';

const fmt = value => {
  if (!value) return 'Not recorded';
  try { return new Intl.DateTimeFormat('en-IE', { dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Dublin' }).format(new Date(value)); }
  catch { return String(value); }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function loadMonthlyData() {
  return await invoke('getAdminData');
}

function clientOption(row) {
  const suffix = `${Number(row.emailCount||0)} email · ${Number(row.smsCount||0)} SMS`;
  return `<option value="${esc(row.clientCode)}">${esc(row.clientCode)} — ${esc(suffix)}</option>`;
}

function statusHtml(status = {}, hour = 10) {
  const scheduler = status.scheduler || {};
  const target = `${String(Number(hour)).padStart(2,'0')}:00`;
  return `<div class="sam-monthly-status">
    <span><strong>Scheduled window:</strong> first Wednesday from ${esc(target)} Ireland time</span>
    <span><strong>Last scheduler check:</strong> ${esc(fmt(scheduler.checkedAt))}</span>
    <span><strong>Last outcome:</strong> ${esc(scheduler.outcome || 'No scheduler result recorded yet')}</span>
    <span><strong>Details:</strong> ${esc(scheduler.reason || 'The next hourly Forge check will update this status.')}</span>
  </div>`;
}

function summaryFor(clientCode, rows) {
  const row = rows.find(x => x.clientCode === clientCode);
  if (!row) return 'No monthly-test recipients are configured for this client.';
  return `${Number(row.contactCount||0)} eligible contact(s) · ${Number(row.emailCount||0)} email destination(s) · ${Number(row.smsCount||0)} SMS destination(s)`;
}

async function enhanceMonthlyTest() {
  const monthlyForm = document.getElementById('monthlyForm');
  if (!monthlyForm || document.querySelector('[data-sam-monthly-tools="true"]')) return;
  const parentCard = monthlyForm.closest('section.card');
  if (!parentCard) return;

  let data;
  try { data = await loadMonthlyData(); }
  catch { return; }

  const status = data?.autoTestStatus || {};
  const rows = Array.isArray(status.clients) ? status.clients : [];
  const card = document.createElement('section');
  card.className = 'card sam-monthly-tools';
  card.dataset.samMonthlyTools = 'true';
  card.innerHTML = `<div class="card-head"><div><h2>Test monthly alert now</h2><p>Run the real monthly-test template and delivery path for one client without marking the automatic monthly run as complete.</p></div></div>
    <div class="card-body sam-monthly-grid">
      <div class="sam-monthly-panel">
        <h3>Manual diagnostic test</h3>
        <p>Choose a client with Monthly Test recipients. This sends through the configured email/SMS providers immediately.</p>
        <select id="samManualMonthlyClient" ${rows.length?'':'disabled'}>
          ${rows.length ? rows.map(clientOption).join('') : '<option value="">No eligible clients</option>'}
        </select>
        <div id="samManualMonthlySummary" class="sam-monthly-summary">${esc(rows.length ? summaryFor(rows[0].clientCode, rows) : 'No monthly-test recipients are configured.')}</div>
        <div class="sam-run-row"><button id="samRunMonthlyNow" type="button" class="btn primary" ${rows.length?'':'disabled'}>Send test now</button><span id="samManualMonthlyResult" class="sam-run-result"></span></div>
      </div>
      <div class="sam-monthly-panel">
        <h3>Scheduler status</h3>
        <p>Use this to confirm that Forge is checking the schedule and to see why the most recent check sent or skipped.</p>
        ${statusHtml(status, status.hour ?? data?.settings?.monthlyTestHour ?? 10)}
      </div>
    </div>`;
  parentCard.after(card);

  const select = card.querySelector('#samManualMonthlyClient');
  const summary = card.querySelector('#samManualMonthlySummary');
  const button = card.querySelector('#samRunMonthlyNow');
  const result = card.querySelector('#samManualMonthlyResult');
  select?.addEventListener('change', () => { summary.textContent = summaryFor(select.value, rows); });
  button?.addEventListener('click', async () => {
    const clientCode = select?.value || '';
    if (!clientCode) return;
    button.disabled = true;
    result.className = 'sam-run-result';
    result.textContent = 'Sending…';
    try {
      const sent = await invoke('runMonthlyTestNow', { clientCode });
      result.className = 'sam-run-result success';
      result.textContent = `Sent: ${Number(sent.emailCount||0)} email · ${Number(sent.smsCount||0)} SMS${Number(sent.smsFailedCount||0) ? ` · ${Number(sent.smsFailedCount)} SMS failed` : ''}`;
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      result.className = 'sam-run-result error';
      result.textContent = error?.message || String(error);
      button.disabled = false;
    }
  });
}

new MutationObserver(() => { enhanceMonthlyTest(); }).observe(document.documentElement, { childList:true, subtree:true });
enhanceMonthlyTest();
