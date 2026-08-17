import { invoke, view } from '@forge/bridge';
import './styles.css';

const APP_VERSION = '3.7.9';
const app = document.querySelector('#app');

const state = {
  context: null,
  data: null,
  alertType: 'initial',
  selected: new Set(),
  sendEmail: true,
  sendSms: true,
  sending: false,
  result: null,
  error: '',
  preview: null,
  previewLoading: false,
  draft: { startTime: '', nextUpdate: '', message: '' }
};

const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);

function issueKeyFromContext(ctx) {
  return ctx?.extension?.issue?.key || ctx?.platformContext?.issueKey || ctx?.extension?.issueKey || ctx?.extension?.modal?.issueKey || '';
}

function eligible(c) {
  if (state.alertType === 'monthly-test') return c.monthlyTestAlerts === true;
  const current = String(state.data?.priority || '').toUpperCase();
  return (c.priorities || []).some(p => String(p).toUpperCase() === current);
}

function channelSummary(c) {
  if (state.alertType === 'monthly-test') {
    const bits=[];
    if (c.email) bits.push('Email available');
    if (c.hasMobile || c.mobileMasked) bits.push('SMS available');
    return bits.join(' · ') || 'No destination';
  }
  const bits=[];
  if (c.emailAlerts && c.email) bits.push('Email');
  if (c.smsAlerts && (c.hasMobile || c.mobileMasked)) bits.push('SMS');
  return bits.join(' · ') || 'No enabled channel';
}

function defaultMessage() {
  const d = state.data;
  if (!d) return '';
  if (state.alertType === 'monthly-test') return `This is the scheduled monthly test of the ${d.settings?.fromName || 'Service Desk'} System Alert service. There is no live service incident. No action is required unless acknowledgement is part of the agreed test process.`;
  if (state.alertType === 'resolved') return `Service has been restored. The incident affecting ${d.summary} is now resolved. We will continue to monitor the service.`;
  if (state.alertType === 'update') return d.description || `Our support team continues to investigate ${d.summary}. Further information will follow as it becomes available.`;
  return d.description || `A ${d.priorityLabel || d.priority} issue has been identified. Our priority escalation process has started and the support team is actively investigating.`;
}

function selectDefaults() {
  state.selected.clear();
  for (const c of state.data?.contacts || []) if (eligible(c)) state.selected.add(c.id);
}

function renderLoading(text='Loading ticket details…') {
  app.innerHTML = `<div class="shell"><div class="loading"><span class="spinner"></span><div style="margin-top:12px">${esc(text)}</div></div></div>`;
}

function renderError(message) {
  app.innerHTML = `<div class="shell"><div class="header"><div><h1>System Alert Manager</h1><p>Unable to open the alert form.</p></div><div class="version">v${APP_VERSION}</div></div><div class="notice error">${esc(message)}</div><div class="actions"><button id="close" class="btn secondary">Close</button></div></div>`;
  byId('close').onclick = () => view.close();
}

function renderResult() {
  const r = state.result;
  const failed = r?.sms?.failed?.length || 0;
  const commentFailed = r?.comment && r.comment.ok === false;
  app.innerHTML = `<div class="shell">
    <div class="header"><div><h1>${r?.isTest ? 'Monthly test sent' : 'System alert sent'}</h1><p>${r?.isTest ? 'The scheduled test has been recorded.' : 'The alert has been recorded on the Jira ticket.'}</p></div><div class="version">v${APP_VERSION}</div></div>
    <div class="notice success">Alert processing completed.</div>
    <div class="result-grid">
      <div class="result-box"><span>Email recipients</span><strong>${r?.email?.attempted || 0}</strong></div>
      <div class="result-box"><span>SMS sent</span><strong>${r?.sms?.sent || 0}</strong></div>
    </div>
    ${failed ? `<div class="notice warn" style="margin-top:12px">${failed} SMS message(s) failed. Check the Twilio error details before sending again.</div>` : ''}
    ${commentFailed ? `<div class="notice warn" style="margin-top:12px">The alert was sent, but the internal Jira audit comment could not be created.</div>` : ''}
    <div class="footer"><div class="left">Reference ${esc(state.data.issueKey)}</div><div class="actions"><button id="close" class="btn primary">Close</button></div></div>
  </div>`;
  byId('close').onclick = async () => { try { await view.refresh(); } catch {} await view.close(); };
}

function render() {
  if (state.result) return renderResult();
  const d = state.data;
  const isTest = state.alertType === 'monthly-test';
  const selectedCount = state.selected.size;
  const eligibleCount = (d.contacts || []).filter(eligible).length;
  // Keep a persistent draft so opening/closing the email preview can never wipe
  // values the agent has entered into Issue Start Time / Next Update Due / message.
  const message = state.draft.message || defaultMessage();
  const start = state.draft.startTime ?? (d.issueStartTime || '');
  const next = state.draft.nextUpdate ?? (d.nextUpdateDue || '');

  app.innerHTML = `<div class="shell">
    <div class="header">
      <div><h1>Send System Alert</h1><p>Review the incident details and recipients before sending.</p></div>
      <div class="version">v${APP_VERSION}</div>
    </div>

    ${state.error ? `<div class="notice error">${esc(state.error)}</div>` : ''}
    ${isTest ? `<div class="notice test"><strong>TEST ONLY.</strong> This mode cannot select live-only recipients and the notification will be clearly marked as a scheduled monthly test.</div>` : ''}

    <section class="card">
      <div class="card-head"><h2>Ticket</h2></div>
      <div class="card-body">
        <div class="issue-strip">
          <div class="metric"><span>Reference</span><strong>${esc(d.issueKey)}</strong></div>
          <div class="metric"><span>Client</span><strong>${esc(d.clientCode || 'Not set')}</strong></div>
          <div class="metric"><span>Priority</span><strong><span class="badge" style="background:${esc(d.priorityColor || '#0C66E4')};color:#fff">${esc(d.priorityLabel || d.priority || 'Not set')}</span></strong></div>
          <div class="metric"><span>Monthly test</span><strong>${d.monthlyTestCompleted ? 'Completed this month' : 'Not completed this month'}</strong></div>
        </div>
        <div class="summary">${esc(d.summary)}</div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Alert type</h2></div>
      <div class="card-body">
        <div class="types">
          ${typeButton('initial','Initial alert','New incident / escalation')}
          ${typeButton('update','Incident update','Progress or material change')}
          ${typeButton('resolved','Service restored','Incident resolved / restored')}
          ${typeButton('monthly-test','Monthly test','Scheduled alert test','test')}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Message</h2></div>
      <div class="card-body">
        ${!isTest ? `<div class="grid2">
          <div class="field"><label for="startTime">Issue start time</label><input id="startTime" value="${esc(start)}" placeholder="e.g. 11 Aug 2026 16:00" /></div>
          <div class="field"><label for="nextUpdate">Next update due</label><input id="nextUpdate" value="${esc(next)}" placeholder="e.g. 17:00 Irish time" /></div>
        </div>` : ''}
        <div class="field"><label for="message">${isTest ? 'Test message' : 'Current situation'}</label><textarea id="message">${esc(message)}</textarea></div>
        <div class="field"><label>Delivery channels</label><div class="channels">
          <label class="channel"><input id="sendEmail" type="checkbox" ${state.sendEmail ? 'checked':''} ${d.settings?.emailEnabled===false?'disabled':''}/> Email</label>
          <label class="channel"><input id="sendSms" type="checkbox" ${state.sendSms ? 'checked':''} ${d.settings?.smsEnabled===false?'disabled':''}/> SMS via Twilio</label>
        </div></div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Recipients</h2><span class="badge ${isTest?'test':'ok'}">${selectedCount} selected</span></div>
      <div class="card-body">
        <div class="recipient-toolbar"><small>${eligibleCount} contact(s) eligible for this alert type.</small><div><button id="all" class="link-btn">Select eligible</button><button id="none" class="link-btn">Clear</button></div></div>
        <div class="contacts">
          ${(d.contacts || []).length ? d.contacts.map(contactRow).join('') : `<div class="empty">No contacts are configured for client ${esc(d.clientCode || '')}.</div>`}
        </div>
      </div>
    </section>

    <div class="footer">
      <div class="left">${isTest ? `Monthly test: ${esc(d.monthlyTestMonth)}` : `Sending from ${esc(d.settings?.fromName || 'Service Desk')}`}</div>
      <div class="actions"><button id="preview" class="btn secondary" ${state.previewLoading?'disabled':''}>${state.previewLoading?'<span class="spinner"></span> Loading…':'Preview Email'}</button><button id="cancel" class="btn secondary">Cancel</button><button id="send" class="btn ${isTest?'primary':'danger'}" ${state.sending?'disabled':''}>${state.sending?'<span class="spinner"></span> Sending…':(isTest?'Send Monthly Test':'Send Alert')}</button></div>
    </div>
    ${state.preview ? `<div class="preview-overlay"><div class="preview-dialog"><div class="preview-head"><div><strong>Email preview</strong><div class="preview-subject">${esc(state.preview.subject)}</div></div><button id="closePreview" class="preview-close" aria-label="Close preview">×</button></div><div class="preview-scroll">${renderEmailPreview(state.preview.model)}</div></div></div>` : ''}
  </div>`;

  bindEvents();
}

function renderEmailPreview(model) {
  if (!model) return '<div class="email-preview-empty">Preview data is unavailable.</div>';
  const p = model.presentation || {};
  const b = model.branding || {};
  const isTest = model.alertType === 'monthly-test';
  const isResolved = model.alertType === 'resolved';
  const next = isResolved ? 'No further update planned' : (model.nextUpdate || 'To be confirmed');
  const details = isTest
    ? [['Reference', model.issueKey], ['Customer', model.clientCode], ['Test month', model.testMonth], ['Current status', p.status]]
    : [['Reference', model.issueKey], ['Customer', model.clientCode], ['Priority', model.priorityLabel || model.priority], ['Issue Start Time', model.startTime || 'Not specified'], ['Next Update Due', next], ['Current status', p.status]];
  const rows = details.map(([k,v]) => {
    const renderedValue = k === 'Priority'
      ? `<span class="email-priority-pill" style="background:${esc(p.accent || '#AE2E24')}">${esc(v || '')}</span>`
      : esc(v || '');
    return `<div class="email-detail-row"><div>${esc(k)}</div><strong>${renderedValue}</strong></div>`;
  }).join('');
  const accent = p.accent || '#AE2E24';
  const soft = p.soft || '#FFECEB';
  const border = p.border || accent;
  const pageBg = b.pageBackground || '#F1F2F4';
  const headerBg = b.headerBackground || '#172B4D';
  const headerText = b.headerText || '#FFFFFF';
  const footerBg = b.footerBackground || '#F7F8F9';
  const brandAccent = b.accentColor || '#0C66E4';
  const fromName = model.fromName || b.serviceName || 'Service Desk';
  const previewLogoSrc = model.logoSrc || model.logoUrl || '';
  const logo = previewLogoSrc ? `<img class="brand-logo" src="${esc(previewLogoSrc)}" alt="" style="display:block;max-height:44px;max-width:190px;margin:0 0 13px;border:0">` : '';
  const support = model.supportUrl ? `<div style="margin-top:6px"><a href="${esc(model.supportUrl)}" target="_blank" rel="noreferrer" style="color:${esc(brandAccent)};text-decoration:none">${esc(model.supportLabel || model.supportUrl)}</a></div>` : '';
  return `<table class="email-preview-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(pageBg)}"><tr><td><div class="email-canvas">
    <div class="email-card">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(headerBg)}"><tr><td class="email-brand">${logo}<div><font color="${esc(headerText)}">${esc(fromName.toUpperCase())}</font></div><h2><font color="${esc(headerText)}">${esc(p.title || model.summary || 'System Alert')}</font></h2></td></tr></table>
      <div class="email-content">
        <div class="email-badge" style="background:${esc(accent)}">${esc(p.badge || `${model.priority} SYSTEM ALERT`)}</div>
        <p class="email-intro">${esc(model.intro || p.intro || '')}</p>
        ${isTest ? `<div class="email-test" style="background:${esc(soft)};border-color:${esc(border)}"><strong>TEST ONLY — NO LIVE SERVICE INCIDENT</strong><br>This message is part of the scheduled monthly System Alert test.</div>` : ''}
        <h3>Incident details</h3>
        <div class="email-details">${rows}</div>
        <div class="email-situation" style="background:${esc(soft)};border-left-color:${esc(accent)}">
          <h3>${isTest ? 'Test details' : 'Current situation'}</h3>
          <div>${esc(model.message || '').replace(/\n/g,'<br>')}</div>
        </div>
        <p class="email-followup">${esc(model.followup || '')}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(footerBg)}"><tr><td class="email-footer"><strong>${esc(fromName)}</strong><br>${esc(isTest ? 'Scheduled System Alert test.' : (model.footerText || `Please reference ${model.issueKey} in any correspondence regarding this incident.`))}${support}</td></tr></table>
    </div>
  </div></td></tr></table>`;
}

function typeButton(type, title, sub, extra='') {
  return `<button class="type-btn ${extra} ${state.alertType===type?'active':''}" data-type="${type}"><strong>${title}</strong><span>${sub}</span></button>`;
}

function contactRow(c) {
  const ok = eligible(c);
  const checked = state.selected.has(c.id);
  return `<label class="contact" style="${ok?'':'opacity:.55'}">
    <input class="contact-check" type="checkbox" data-id="${esc(c.id)}" ${checked?'checked':''} ${ok?'':'disabled'} />
    <div><div class="contact-name">${esc(c.name)}</div><div class="contact-sub">${esc(c.email || 'No email')}</div></div>
    <div><div class="contact-sub">${esc(c.mobileMasked || 'No mobile')}</div><div class="contact-sub">${esc(channelSummary(c))}</div></div>
    <div class="badges">${(c.priorities||[]).map(p=>`<span class="badge">${esc(p)}</span>`).join('')}${c.monthlyTestAlerts?'<span class="badge test">Monthly Test</span>':''}</div>
  </label>`;
}

function bindEvents() {
  document.querySelectorAll('.brand-logo').forEach(img => {
    const hide = () => { img.style.display = 'none'; };
    img.addEventListener('error', hide, { once: true });
    if (img.complete && !img.naturalWidth) hide();
  });
  document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
    const message = byId('message')?.value ?? state.draft.message;
    state.draft.startTime = byId('startTime')?.value ?? state.draft.startTime;
    state.draft.nextUpdate = byId('nextUpdate')?.value ?? state.draft.nextUpdate;
    state.alertType = b.dataset.type;
    state.error = '';
    state.draft.message = state.alertType === 'monthly-test' ? defaultMessage() : (message || defaultMessage());
    selectDefaults();
    render();
  });
  document.querySelectorAll('.contact-check').forEach(cb => cb.onchange = () => {
    cb.checked ? state.selected.add(cb.dataset.id) : state.selected.delete(cb.dataset.id);
    const badge = document.querySelector('.card-head .badge');
    if (badge) badge.textContent = `${state.selected.size} selected`;
  });
  byId('all').onclick = () => { selectDefaults(); render(); };
  byId('none').onclick = () => { state.selected.clear(); render(); };
  byId('sendEmail').onchange = e => state.sendEmail = e.target.checked;
  byId('sendSms').onchange = e => state.sendSms = e.target.checked;
  if (byId('startTime')) byId('startTime').oninput = e => state.draft.startTime = e.target.value;
  if (byId('nextUpdate')) byId('nextUpdate').oninput = e => state.draft.nextUpdate = e.target.value;
  if (byId('message')) byId('message').oninput = e => state.draft.message = e.target.value;
  byId('preview').onclick = previewEmail;
  if (byId('closePreview')) byId('closePreview').onclick = () => { state.preview = null; render(); };
  byId('cancel').onclick = () => view.close();
  byId('send').onclick = send;
}

function currentPayload() {
  return {
    issueKey: state.data.issueKey,
    clientCode: state.data.clientCode,
    priority: state.data.priority,
    summary: state.data.summary,
    alertType: state.alertType,
    contactIds: [...state.selected],
    sendEmail: Boolean(byId('sendEmail')?.checked),
    sendSms: Boolean(byId('sendSms')?.checked),
    startTime: (byId('startTime')?.value ?? state.draft.startTime ?? '').trim(),
    nextUpdate: (byId('nextUpdate')?.value ?? state.draft.nextUpdate ?? '').trim(),
    message: (byId('message')?.value ?? state.draft.message ?? '').trim(),
    testMonth: state.data.monthlyTestMonth
  };
}

async function previewEmail() {
  state.error = '';
  const payload = currentPayload();
  if (!payload.message) { state.error='Enter a message before previewing the email.'; return render(); }
  state.previewLoading = true;
  render();
  try {
    state.preview = await invoke('previewEmail', payload);
    state.previewLoading = false;
    render();
  } catch (e) {
    state.previewLoading = false;
    state.error = e?.message || String(e);
    render();
  }
}

async function send() {
  state.error = '';
  state.sendEmail = Boolean(byId('sendEmail')?.checked);
  state.sendSms = Boolean(byId('sendSms')?.checked);
  if (!state.selected.size) { state.error='Select at least one recipient.'; return render(); }
  if (!state.sendEmail && !state.sendSms) { state.error='Select Email, SMS, or both.'; return render(); }
  const message = byId('message')?.value?.trim();
  if (!message) { state.error='Enter a message.'; return render(); }

  const payload = currentPayload();

  state.sending = true;
  render();
  try {
    state.result = await invoke('sendAlert', payload);
    state.sending = false;
    render();
  } catch (e) {
    state.sending = false;
    state.error = e?.message || String(e);
    render();
  }
}

async function init() {
  renderLoading();
  try {
    try { await view.theme.enable(); } catch {}
    state.context = await view.getContext();
    const issueKey = issueKeyFromContext(state.context);
    if (!issueKey) throw new Error('Jira did not provide an issue key to the System Alert action.');
    state.data = await invoke('getIssueAlertData', { issueKey });
    state.draft = {
      startTime: state.data.issueStartTime || '',
      nextUpdate: state.data.nextUpdateDue || '',
      message: defaultMessage()
    };
    state.sendEmail = state.data.settings?.emailEnabled !== false;
    state.sendSms = state.data.settings?.smsEnabled !== false;
    selectDefaults();
    render();
  } catch (e) {
    renderError(e?.message || String(e));
  }
}

init();
