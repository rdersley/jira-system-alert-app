import { invoke } from '@forge/bridge';
import './styles.css';

const APP_VERSION = '3.7.8';
const app = document.querySelector('#app');

const state = {
  data: null,
  editingId: null,
  message: '',
  error: '',
  busy: false,
  activeSection: 'general',
  activeTemplate: 'branding',
  preview: null
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
  const { settings = {}, contacts = [], clientOptions = [], providerStatus = {}, providerSettings = {}, templates = {}, branding = {}, setupStatus = {} } = state.data;
  const editing = state.editingId ? contacts.find(c => c.id === state.editingId) : null;
  const c = editing || {};
  const active = state.activeSection || 'general';

  app.innerHTML = `<div class="page">
    <header class="hero">
      <div>
        <h1>System Alert Manager</h1>
        <p>Configure incident communications, delivery providers, templates and client contacts.</p>
      </div>
      <span class="version">v${esc(state.data.appVersion || APP_VERSION)}</span>
    </header>

    <nav class="admin-nav" aria-label="System Alert settings">
      ${navButton('general','General',active)}
      ${navButton('contacts','Clients & Contacts',active)}
      ${navButton('providers','Communication Providers',active)}
      ${navButton('templates','Templates',active)}
      ${navButton('monthly','Monthly Test',active)}
    </nav>

    ${state.message ? `<div class="notice success">${esc(state.message)}</div>` : ''}
    ${state.error ? `<div class="notice error">${esc(state.error)}</div>` : ''}

    ${active === 'general' ? `
    <section class="card setup-overview">
      <div class="card-head"><div><h2>Setup status</h2><p>A quick check of the items required before System Alert Manager is ready for live incidents.</p></div></div>
      <div class="card-body setup-grid">
        ${setupItem('Jira configuration', setupStatus.jira, 'Project, Client field and priorities')}
        ${setupItem('Jira client list', setupStatus.clients, `${clientOptions.length} client option${clientOptions.length===1?'':'s'} loaded`)}
        ${setupItem('Email provider', setupStatus.email, providerStatus.email?.configured ? `${providerStatus.email.provider} ready` : 'Needs configuration')}
        ${setupItem('SMS provider', setupStatus.sms, providerStatus.sms?.configured ? `${providerStatus.sms.provider} ready` : 'Needs configuration')}
        ${setupItem('Contacts', Number(setupStatus.contacts||0)>0, `${Number(setupStatus.contacts||0)} saved contact${Number(setupStatus.contacts||0)===1?'':'s'}`)}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>App settings</h2><p>Choose the Jira project and priorities that can use System Alert. These Jira fields pre-fill the alert.</p></div></div>
      <form id="settingsForm" class="card-body form-grid">
        ${field('clientFieldId','Client Jira field ID', settings.clientFieldId || '', 'customfield_10115')}
        ${field('issueStartFieldId','Issue Start Time field ID', settings.issueStartFieldId || 'customfield_10786', 'customfield_10786')}
        ${field('nextUpdateFieldId','Next Update Due field ID', settings.nextUpdateFieldId || 'customfield_10788', 'customfield_10788')}
        ${field('allowedProjectKey','Allowed project', settings.allowedProjectKey || 'SD', 'SD')}
        ${field('fromName','Sender display name', settings.fromName || 'Service Desk', 'Service Desk')}
        ${field('replyToEmail','Reply-to email', settings.replyToEmail || '', 'servicedesk@example.com','', 'email')}
        <div class="field wide"><label>System Alert priorities</label><p class="help">Add the Jira priority names that should show the System Alert button. Names must match Jira exactly. You can also set the label and colour used in notifications.</p><div id="priorityConfigRows" class="priority-config-list">${renderPriorityConfigRows(settings.priorityConfigs || [])}</div><button id="addPriority" class="btn secondary small" type="button">+ Add priority</button></div>
        <div class="form-actions wide"><button class="btn primary" type="submit">Save settings</button></div>
      </form>
    </section>` : ''}

    ${active === 'providers' ? `
    <section class="card">
      <div class="card-head"><div><h2>Communication providers</h2><p>Configure SendGrid email and Twilio SMS. Secret values are stored encrypted and are never displayed again after saving.</p></div></div>
      <div class="card-body provider-grid">
        ${providerCard('Email', providerStatus.email)}
        ${providerCard('SMS', providerStatus.sms)}
      </div>
      <form id="providerForm" class="card-body provider-config-grid">
        <div class="provider-config-block"><h3>Email · SendGrid</h3><p class="help">Existing Forge environment variables remain supported. Enter a secret only when adding or replacing it.</p>
          ${field('sendgridFromEmail','From email', providerSettings.sendgridFromEmail || providerStatus.email?.from || '', 'servicedesk@example.com','', 'email')}
          ${field('sendgridFromName','From name', providerSettings.sendgridFromName || settings.fromName || 'Service Desk', 'Service Desk')}
          ${field('sendgridReplyToEmail','Reply-to email', providerSettings.sendgridReplyToEmail || settings.replyToEmail || '', 'servicedesk@example.com','', 'email')}
          ${secretField('sendgridApiKey','SendGrid API key', providerStatus.email?.configured ? 'Configured — leave blank to keep current key' : 'SG.xxxxx')}
        </div>
        <div class="provider-config-block"><h3>SMS · Twilio</h3><p class="help">Use either a From number or Messaging Service SID. Existing Forge variables remain supported.</p>
          ${secretField('twilioAccountSid','Account SID', providerStatus.sms?.configured ? 'Configured — leave blank to keep current SID' : 'ACxxxxxxxx')}
          ${secretField('twilioAuthToken','Auth token', providerStatus.sms?.configured ? 'Configured — leave blank to keep current token' : 'Enter auth token')}
          ${secretField('twilioApiKey','API key SID (optional)', 'SKxxxxxxxx')}
          ${secretField('twilioApiSecret','API key secret (optional)', 'Leave blank if using Auth Token')}
          ${field('twilioFromNumber','From number', providerSettings.twilioFromNumber || '', '+44...')}
          ${field('twilioMessagingServiceSid','Messaging Service SID', providerSettings.twilioMessagingServiceSid || '', 'MGxxxxxxxx')}
          <div class="field"><label for="twilioRegion">Twilio region</label><select id="twilioRegion"><option value="global" ${providerSettings.twilioRegion!=='ie1'?'selected':''}>Global</option><option value="ie1" ${providerSettings.twilioRegion==='ie1'?'selected':''}>Ireland (IE1)</option></select></div>
        </div>
        <div class="form-actions wide"><button class="btn primary" type="submit">Save provider configuration</button></div>
      </form>
    </section>` : ''}

    ${active === 'templates' ? `
    <section class="card templates-page">
      <div class="card-head"><div><h2>Branding & templates</h2><p>Control how System Alert emails look and edit the wording for each notification type.</p></div></div>
      <div class="template-subnav">
        ${templateNavButton('branding','Branding')}
        ${templateNavButton('initial','Initial Alert')}
        ${templateNavButton('update','Incident Update')}
        ${templateNavButton('resolved','Service Restored')}
        ${templateNavButton('monthly-test','Monthly Test')}
      </div>
      ${state.activeTemplate === 'branding' ? renderBrandingEditor(branding) : renderSingleTemplatePage(state.activeTemplate, templates[state.activeTemplate] || {})}
    </section>
    ${renderPreviewModal()}` : ''}

    ${active === 'contacts' ? `
    <section class="card ${editing ? 'editing' : ''}">
      <div class="card-head"><div><h2>${editing ? 'Edit contact' : 'Add contact'}</h2><p>${editing ? 'Update the saved contact details and alert preferences.' : 'Add a contact or distribution list for a client.'}</p></div>${editing ? `<button id="cancelEditTop" class="btn secondary" type="button">Cancel edit</button>` : ''}</div>
      <form id="contactForm" class="card-body form-grid">
        <div class="field wide"><label for="clientOptionId">Client</label><select id="clientOptionId" name="clientOptionId" required><option value="">Select a client from the Jira Client field…</option>${clientOptions.map(o => `<option value="${esc(o.optionId)}" ${String(c.clientOptionId||'')===String(o.optionId)?'selected':''}>${esc(o.value)}</option>`).join('')}</select><p class="help">Loaded directly from ${esc(settings.clientFieldId || 'the configured Jira Client field')}.</p></div>
        ${field('name','Contact / distribution list name', c.name || '', 'Operations Team','wide')}
        ${field('email','Email address', c.email || '', 'name@example.com','', 'email')}
        ${field('mobile','Mobile number', c.mobile || '', '+353...')}
        <div class="field wide"><label>Live incident priorities</label><div class="priority-options">${renderContactPriorityOptions(c.priorities || [], settings.priorityConfigs || [])}</div><p class="help">Only priorities enabled in General settings can be assigned to contacts.</p></div>
        <div class="checks wide"><label><input id="emailAlerts" type="checkbox" ${checked(c.emailAlerts === true)}> Receive email alerts</label><label><input id="smsAlerts" type="checkbox" ${checked(c.smsAlerts === true)}> Receive SMS alerts</label><label><input id="monthlyTestAlerts" type="checkbox" ${checked(c.monthlyTestAlerts === true)}> Receive Monthly System Alert Test</label></div>
        <div class="form-actions wide">${editing ? `<button id="cancelEdit" class="btn secondary" type="button">Cancel</button>` : ''}<button class="btn primary" type="submit">${editing ? 'Save changes' : 'Add contact'}</button></div>
      </form>
    </section>
    <section class="card"><div class="card-head"><div><h2>Current contacts</h2><p>${contacts.length} saved contact${contacts.length === 1 ? '' : 's'}, grouped by client.</p></div><input id="contactFilter" class="contact-filter" placeholder="Filter contacts or clients…"></div><div id="contactsHost" class="contacts">${renderGroupedContacts(contacts)}</div></section>` : ''}

    ${active === 'monthly' ? `
    <section class="card">
      <div class="card-head"><div><h2>Automatic monthly test</h2><p>Schedule and review the first-Wednesday System Alert test.</p></div></div>
      <form id="monthlyForm" class="card-body form-grid">
        <div class="field wide"><label>Automatic monthly test</label><div class="checks inline-checks"><label><input id="monthlyTestEnabled" type="checkbox" ${checked(settings.monthlyTestEnabled !== false)}> Enabled</label><label>Run from <select id="monthlyTestHour">${Array.from({length:24},(_,h)=>`<option value="${h}" ${Number(settings.monthlyTestHour ?? 10)===h?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}</select> Ireland time on the first Wednesday</label></div><p class="help">Forge checks hourly. The test sends on the first hourly run at or after this time, once per client.</p></div>
        <div class="form-actions wide"><button class="btn primary" type="submit">Save monthly test settings</button></div>
      </form>
    </section>
    <section class="card"><div class="card-head"><div><h2>Monthly test history</h2><p>Recipient lists remain isolated by client code.</p></div></div><div class="card-body">${renderAutoTestStatus(state.data.autoTestStatus)}</div></section>` : ''}
  </div>`;

  bindEvents();
}

function navButton(key, label, active) {
  return `<button type="button" class="admin-nav-item ${active===key?'active':''}" data-section="${key}">${esc(label)}</button>`;
}

function templateNavButton(key, label) {
  return `<button type="button" class="template-nav-item ${state.activeTemplate===key?'active':''}" data-template-section="${esc(key)}">${esc(label)}</button>`;
}

function renderBrandingEditor(b = {}) {
  return `<form id="brandingForm" class="card-body branding-layout">
    <div class="branding-form">
      <div class="section-title"><h3>Email branding</h3><p>These settings are shared by every email template. Priority badges keep their configured incident colours.</p></div>
      ${field('brandServiceName','Service / company name', b.serviceName || state.data.settings?.fromName || 'Service Desk', 'Service Desk')}
      <div class="field wide brand-logo-upload"><label for="brandLogoFile">Logo</label><div class="logo-upload-row">${b.logoDataUrl ? `<div class="logo-current"><img src="${esc(b.logoDataUrl)}" alt="Current logo"><span>${esc(b.logoFileName || 'Uploaded logo')}</span></div>` : '<div class="logo-empty">No uploaded logo</div>'}<div class="logo-upload-actions"><input id="brandLogoFile" type="file" accept="image/png,image/jpeg"><button id="removeBrandLogo" class="btn secondary" type="button" ${b.logoUploaded?'':'disabled'}>Remove uploaded logo</button></div></div><p class="help">PNG or JPG, maximum 140 KB. Uploaded logos are stored with this Jira app installation and embedded into outgoing SendGrid emails.</p></div>
      ${field('brandLogoUrl','Fallback logo URL (optional)', b.logoUrl || '', 'https://example.com/logo.png','wide','url')}
      <div class="colour-grid">
        ${colorField('brandHeaderBackground','Header background',b.headerBackground || '#172B4D')}
        ${colorField('brandHeaderText','Header text',b.headerText || '#FFFFFF')}
        ${colorField('brandAccentColor','Brand accent',b.accentColor || '#0C66E4')}
        ${colorField('brandPageBackground','Email background',b.pageBackground || '#F1F2F4')}
        ${colorField('brandFooterBackground','Footer background',b.footerBackground || '#F7F8F9')}
      </div>
      <div class="field wide"><label for="brandFooterText">Footer text</label><textarea id="brandFooterText" rows="3">${esc(b.footerText || 'Please reference {{issueKey}} in any correspondence regarding this incident.')}</textarea><p class="help">You can use template tokens such as {{issueKey}} and {{clientCode}}.</p></div>
      ${field('brandSupportLabel','Support link label', b.supportLabel || '', 'Contact Service Desk')}
      ${field('brandSupportUrl','Support URL', b.supportUrl || '', 'https://support.example.com','','url')}
      <div class="form-actions wide branding-actions"><button id="resetBranding" class="btn secondary" type="button">Reset branding</button><button id="previewBranding" class="btn secondary" type="button">Preview Email</button><button class="btn primary" type="submit">Save branding</button></div>
    </div>
    <aside class="branding-note"><strong>Branding applies automatically</strong><p>All Initial Alert, Incident Update, Service Restored and Monthly Test emails inherit these settings.</p><p>The HTML structure remains controlled by System Alert Manager so a wording or colour change cannot break the responsive email layout.</p></aside>
  </form>`;
}

function renderSingleTemplatePage(key, template = {}) {
  const labels = {initial:'Initial Alert',update:'Incident Update',resolved:'Service Restored','monthly-test':'Monthly Test'};
  return `<div class="card-body template-help"><strong>Available tokens:</strong> {{priority}}, {{jiraPriority}}, {{clientCode}}, {{issueKey}}, {{summary}}, {{startTime}}, {{nextUpdate}}, {{message}}, {{testMonth}}</div>
  <form id="singleTemplateForm" class="card-body single-template-layout" data-template-key="${esc(key)}">
    <div class="template-editor-main"><div class="section-title"><h3>${esc(labels[key] || key)}</h3><p>Customize the customer-facing wording. Branding and responsive layout are inherited automatically.</p></div>
      <div class="field"><label for="templateSubject">Email subject</label><input id="templateSubject" value="${esc(template.subject || '')}"></div>
      <div class="field"><label for="templateIntro">Email introduction</label><textarea id="templateIntro" rows="5">${esc(template.intro || '')}</textarea></div>
      <div class="field"><label for="templateFollowup">Email follow-up</label><textarea id="templateFollowup" rows="5">${esc(template.followup || '')}</textarea></div>
      <div class="field"><label for="templateSms">SMS template</label><textarea id="templateSms" rows="12">${esc(template.sms || '')}</textarea><p class="help">SMS is capped at 700 characters after token replacement.</p></div>
      <div class="form-actions"><button id="resetCurrentTemplate" class="btn secondary" type="button">Reset default</button><button id="previewSms" class="btn secondary" type="button">Preview SMS</button><button id="previewEmail" class="btn secondary" type="button">Preview Email</button><button class="btn primary" type="submit">Save Template</button></div>
    </div>
  </form>`;
}

function colorField(id,label,value){return `<div class="field color-control"><label for="${id}">${esc(label)}</label><div class="color-input"><input id="${id}" type="color" value="${esc(value)}"><span>${esc(value)}</span></div></div>`;}

function collectBranding(){return {
  serviceName:getValue('brandServiceName'), logoUrl:getValue('brandLogoUrl'), headerBackground:byId('brandHeaderBackground')?.value || '#172B4D', headerText:byId('brandHeaderText')?.value || '#FFFFFF', accentColor:byId('brandAccentColor')?.value || '#0C66E4', pageBackground:byId('brandPageBackground')?.value || '#F1F2F4', footerBackground:byId('brandFooterBackground')?.value || '#F7F8F9', footerText:byId('brandFooterText')?.value || '', supportLabel:getValue('brandSupportLabel'), supportUrl:getValue('brandSupportUrl')
};}

function readLogoFile(file) {
  return new Promise((resolve,reject) => {
    if (!file) return reject(new Error('Choose a PNG or JPG logo first.'));
    if (!['image/png','image/jpeg'].includes(file.type)) return reject(new Error('Logo must be a PNG or JPG image.'));
    if (file.size > 140 * 1024) return reject(new Error('Logo is too large. Please choose a PNG/JPG smaller than 140 KB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The logo image could not be read.'));
    reader.onload = () => { const value=String(reader.result||''); const comma=value.indexOf(','); if(comma<0) return reject(new Error('The logo image could not be read.')); resolve({fileName:file.name,contentType:file.type,data:value.slice(comma+1)}); };
    reader.readAsDataURL(file);
  });
}

function collectCurrentTemplate(){return {subject:byId('templateSubject')?.value || '',intro:byId('templateIntro')?.value || '',followup:byId('templateFollowup')?.value || '',sms:byId('templateSms')?.value || ''};}

function renderBrandedEmailPreview(model) {
  if (!model) return '<div style="padding:24px">Preview data is unavailable.</div>';
  const p = model.presentation || {};
  const b = model.branding || {};
  const isTest = model.alertType === 'monthly-test';
  const isResolved = model.alertType === 'resolved';
  const next = isResolved ? 'No further update planned' : (model.nextUpdate || 'To be confirmed');
  const details = isTest
    ? [['Reference', model.issueKey], ['Customer', model.clientCode], ['Test month', model.testMonth], ['Current status', p.status]]
    : [['Reference', model.issueKey], ['Customer', model.clientCode], ['Priority', model.priorityLabel || model.priority], ['Issue Start Time', model.startTime || 'Not specified'], ['Next Update Due', next], ['Current status', p.status]];
  const rows = details.map(([k,v],i) => {
    const border = i < details.length - 1 ? 'border-bottom:1px solid #EBECF0;' : '';
    const value = k === 'Priority' ? `<span style="display:inline-block;background:${esc(p.accent || '#AE2E24')};color:#fff;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700">${esc(v || '')}</span>` : esc(v || '');
    return `<div style="display:grid;grid-template-columns:34% 1fr;${border}"><div style="padding:10px 12px;color:#626F86;font-size:12px">${esc(k)}</div><div style="padding:10px 12px;color:#172B4D;font-size:12px;font-weight:700">${value}</div></div>`;
  }).join('');
  const headerBg = b.headerBackground || '#172B4D';
  const headerText = b.headerText || '#FFFFFF';
  const pageBg = b.pageBackground || '#F1F2F4';
  const footerBg = b.footerBackground || '#F7F8F9';
  const accent = p.accent || '#AE2E24';
  const soft = p.soft || '#FFECEB';
  const brandAccent = b.accentColor || '#0C66E4';
  const fromName = model.fromName || b.serviceName || 'Service Desk';
  const logo = model.logoUrl ? `<img class="brand-logo" src="${esc(model.logoUrl)}" alt="" style="display:block;max-height:44px;max-width:190px;margin-bottom:13px;border:0">` : '';
  const support = model.supportUrl ? `<div style="margin-top:6px"><a href="${esc(model.supportUrl)}" target="_blank" rel="noreferrer" style="color:${esc(brandAccent)};text-decoration:none">${esc(model.supportLabel || model.supportUrl)}</a></div>` : '';
  return `<table class="admin-preview-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(pageBg)}"><tr><td><div class="admin-preview-card">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(headerBg)}"><tr><td class="admin-preview-header">${logo}<div style="font-size:11px;letter-spacing:1.4px;font-weight:700;opacity:.8"><font color="${esc(headerText)}">${esc(fromName.toUpperCase())}</font></div><div style="margin-top:8px;font-size:24px;font-weight:700;line-height:1.25"><font color="${esc(headerText)}">${esc(p.title || model.summary || 'System Alert')}</font></div></td></tr></table>
    <div class="admin-preview-content"><span style="display:inline-block;background:${esc(accent)};color:#fff;border-radius:5px;padding:8px 13px;font-size:12px;font-weight:700">${esc(p.badge || `${model.priority} SYSTEM ALERT`)}</span><div style="margin-top:17px;font-size:14px;line-height:1.6">${esc(model.intro || p.intro || '')}</div></div>
    ${isTest ? `<div style="margin:0 30px 20px;padding:14px 16px;background:${esc(soft)};border:1px solid ${esc(p.border || accent)};border-radius:8px;font-size:13px"><strong>TEST ONLY — NO LIVE SERVICE INCIDENT</strong><br>This message is part of the scheduled monthly System Alert test.</div>` : ''}
    <div style="padding:4px 30px 20px"><div style="font-size:16px;font-weight:700;margin-bottom:10px">Incident details</div><div style="border:1px solid #DFE1E6;border-radius:8px;overflow:hidden">${rows}</div></div>
    <div style="padding:0 30px 28px"><div style="background:${esc(soft)};border-left:4px solid ${esc(accent)};border-radius:6px;padding:16px 18px"><div style="font-size:15px;font-weight:700;margin-bottom:8px">${isTest ? 'Test details' : 'Current situation'}</div><div style="font-size:13px;line-height:1.6">${esc(model.message || '').replace(/\n/g,'<br>')}</div></div><div style="font-size:13px;line-height:1.6;margin-top:18px">${esc(model.followup || '')}</div></div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(footerBg)}"><tr><td class="admin-preview-footer"><strong>${esc(fromName)}</strong><br>${esc(isTest ? 'Scheduled System Alert test.' : (model.footerText || ''))}${support}</td></tr></table>
  </div></td></tr></table>`;
}

function renderPreviewModal(){
  if(!state.preview)return '';
  const isSms=state.preview.kind==='sms';
  return `<div class="preview-backdrop"><div class="preview-modal"><div class="preview-head"><div><h3>${isSms?'SMS preview':'Email preview'}</h3>${!isSms&&state.preview.subject?`<p>${esc(state.preview.subject)}</p>`:''}</div><button id="closePreview" class="preview-close" type="button">×</button></div><div class="preview-body">${isSms?`<pre class="sms-preview">${esc(state.preview.sms||'')}</pre>`:`<div class="admin-email-preview">${renderBrandedEmailPreview(state.preview.model)}</div>`}</div></div></div>`;
}

function setupItem(label, ok, detail='') {
  return `<div class="setup-item ${ok?'ok':'bad'}"><span class="setup-icon">${ok?'✓':'!'}</span><div><strong>${esc(label)}</strong><p>${esc(detail)}</p></div></div>`;
}

function secretField(id, label, placeholder='') {
  return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" type="password" value="" placeholder="${esc(placeholder)}" autocomplete="new-password"><p class="help">Saved as an encrypted secret. Current value is never returned to this page.</p></div>`;
}

function renderTemplateEditor(key, label, template = {}) {
  return `<fieldset class="template-card" data-template="${esc(key)}"><legend>${esc(label)}</legend>
    <div class="field wide"><label>Subject</label><input class="template-subject" value="${esc(template.subject || '')}"></div>
    <div class="field wide"><label>Email introduction</label><textarea class="template-intro" rows="3">${esc(template.intro || '')}</textarea></div>
    <div class="field wide"><label>Email follow-up</label><textarea class="template-followup" rows="3">${esc(template.followup || '')}</textarea></div>
    <div class="field wide"><label>SMS template</label><textarea class="template-sms" rows="9">${esc(template.sms || '')}</textarea><p class="help">SMS is capped at 700 characters after token replacement.</p></div>
  </fieldset>`;
}

function collectTemplates() {
  const out = {};
  document.querySelectorAll('[data-template]').forEach(card => {
    out[card.dataset.template] = {
      subject: card.querySelector('.template-subject')?.value || '',
      intro: card.querySelector('.template-intro')?.value || '',
      followup: card.querySelector('.template-followup')?.value || '',
      sms: card.querySelector('.template-sms')?.value || ''
    };
  });
  return out;
}

function providerCard(label, status = {}) {
  const ok = status.configured === true;
  return `<div class="provider-card ${ok?'ok':'bad'}"><div><strong>${esc(label)} · ${esc(status.provider || '')}</strong><p>${ok ? 'Configured and available' : 'Not fully configured'}</p>${status.from ? `<small>From: ${esc(status.from)}</small>` : ''}${status.sender ? `<small>Sender: ${esc(status.sender)}</small>` : ''}${status.source ? `<small>Source: ${esc(status.source)}</small>` : ''}</div><span class="provider-pill">${ok?'✓ Ready':'Needs setup'}</span></div>`;
}
function renderGroupedContacts(contacts = [], filter='') {
  const q = String(filter||'').toLowerCase();
  const visible = contacts.filter(c => !q || [c.clientCode,c.clientName,c.name,c.email].some(v => String(v||'').toLowerCase().includes(q)));
  if (!visible.length) return `<div class="empty">No matching contacts.</div>`;
  const groups = new Map();
  visible.forEach(c => { const key = c.clientValue || `${c.clientCode} - ${c.clientName}`; if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(c); });
  return [...groups.entries()].map(([client,rows]) => `<div class="client-group"><div class="client-group-head"><strong>${esc(client)}</strong><span>${rows.length} contact${rows.length===1?'':'s'}</span></div>${rows.map(contactCard).join('')}</div>`).join('');
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
      ${c.email ? `<button class="btn secondary test-contact" data-id="${esc(c.id)}" data-channel="email" type="button">Test email</button>` : ''}
      ${c.mobile ? `<button class="btn secondary test-contact" data-id="${esc(c.id)}" data-channel="sms" type="button">Test SMS</button>` : ''}
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

function settingsValue(id, fallback) { const el=byId(id); return el ? el.checked : fallback; }

function getValue(id) { return byId(id)?.value?.trim() || ''; }

function bindEvents() {
  document.querySelectorAll('.brand-logo').forEach(img => {
    const hide = () => { img.style.display = 'none'; };
    img.addEventListener('error', hide, { once: true });
    if (img.complete && !img.naturalWidth) hide();
  });
  document.querySelectorAll('[data-section]').forEach(btn => btn.onclick = () => { state.activeSection = btn.dataset.section; state.editingId = null; state.message=''; state.error=''; render(); window.scrollTo({top:0,behavior:'smooth'}); });

  document.querySelectorAll('[data-template-section]').forEach(btn => btn.onclick = () => { state.activeTemplate = btn.dataset.templateSection; state.preview=null; state.message=''; state.error=''; render(); });
  if (byId('closePreview')) byId('closePreview').onclick = () => { state.preview=null; render(); };

  if (byId('settingsForm')) byId('settingsForm').onsubmit = async e => {
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
        monthlyTestEnabled: settingsValue('monthlyTestEnabled', state.data.settings.monthlyTestEnabled !== false),
        monthlyTestHour: Number(state.data.settings.monthlyTestHour ?? 10)
      });
      state.message = 'Settings saved.';
      await load();
    });
  };

  if (byId('addPriority')) byId('addPriority').onclick = () => {
    const host = byId('priorityConfigRows');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPriorityConfigRows([{ name:'', label:'', color:'#0C66E4' }]);
    const row = wrapper.firstElementChild;
    host.appendChild(row);
    bindPriorityRowButtons();
  };
  bindPriorityRowButtons();

  if (byId('providerForm')) byId('providerForm').onsubmit = async e => {
    e.preventDefault();
    await act(async () => {
      await invoke('saveProviderSettings', {
        sendgridFromEmail: getValue('sendgridFromEmail'),
        sendgridFromName: getValue('sendgridFromName'),
        sendgridReplyToEmail: getValue('sendgridReplyToEmail'),
        sendgridApiKey: getValue('sendgridApiKey'),
        twilioAccountSid: getValue('twilioAccountSid'),
        twilioAuthToken: getValue('twilioAuthToken'),
        twilioApiKey: getValue('twilioApiKey'),
        twilioApiSecret: getValue('twilioApiSecret'),
        twilioFromNumber: getValue('twilioFromNumber'),
        twilioMessagingServiceSid: getValue('twilioMessagingServiceSid'),
        twilioRegion: byId('twilioRegion')?.value || 'global'
      });
      state.message = 'Communication provider configuration saved.';
      await load();
    });
  };

  if (byId('brandingForm')) byId('brandingForm').onsubmit = async e => {
    e.preventDefault();
    await act(async () => { await invoke('saveBranding', collectBranding()); state.message='Branding saved.'; await load(); });
  };
  if (byId('brandLogoFile')) byId('brandLogoFile').onchange = async e => {
    const file=e.target.files?.[0]; if(!file) return;
    try { const payload=await readLogoFile(file); await act(async()=>{ await invoke('saveBrandLogo',payload); state.message='Logo uploaded.'; await load(); }); }
    catch(err){ state.error=err?.message || String(err); render(); }
  };
  if (byId('removeBrandLogo')) byId('removeBrandLogo').onclick = async () => {
    if(!confirm('Remove the uploaded email logo?')) return;
    await act(async()=>{ await invoke('deleteBrandLogo'); state.message='Uploaded logo removed.'; await load(); });
  };
  if (byId('resetBranding')) byId('resetBranding').onclick = async () => {
    if (!confirm('Reset email branding to the System Alert defaults?')) return;
    await act(async () => { await invoke('resetBranding'); state.message='Branding reset to defaults.'; await load(); });
  };
  const previewDraft = async (kind, key, template, branding) => {
    await act(async () => { const result=await invoke('previewTemplate',{templateType:key,template,branding}); state.preview={kind,...result}; render(); });
  };
  if (byId('previewBranding')) byId('previewBranding').onclick = () => previewDraft('email','initial',state.data.templates?.initial || {},collectBranding());
  if (byId('singleTemplateForm')) byId('singleTemplateForm').onsubmit = async e => {
    e.preventDefault(); const key=byId('singleTemplateForm').dataset.templateKey; const all={...(state.data.templates||{}),[key]:collectCurrentTemplate()};
    await act(async () => { await invoke('saveTemplates',all); state.message=`${key==='monthly-test'?'Monthly Test':key==='resolved'?'Service Restored':key==='update'?'Incident Update':'Initial Alert'} template saved.`; await load(); });
  };
  if (byId('resetCurrentTemplate')) byId('resetCurrentTemplate').onclick = async () => {
    const key=byId('singleTemplateForm')?.dataset.templateKey; if(!key || !confirm('Reset this template to the System Alert default wording?')) return;
    await act(async () => { const defaults=await invoke('resetTemplates'); const current={...(state.data.templates||{}),[key]:defaults[key]}; await invoke('saveTemplates',current); state.message='Template reset to default.'; await load(); });
  };
  if (byId('previewEmail')) byId('previewEmail').onclick = () => { const key=byId('singleTemplateForm').dataset.templateKey; previewDraft('email',key,collectCurrentTemplate(),state.data.branding||{}); };
  if (byId('previewSms')) byId('previewSms').onclick = () => { const key=byId('singleTemplateForm').dataset.templateKey; previewDraft('sms',key,collectCurrentTemplate(),state.data.branding||{}); };

  if (byId('monthlyForm')) byId('monthlyForm').onsubmit = async e => {
    e.preventDefault();
    await act(async () => {
      const current = state.data.settings || {};
      await invoke('saveSettings', {
        clientFieldId: current.clientFieldId || '',
        issueStartFieldId: current.issueStartFieldId || 'customfield_10786',
        nextUpdateFieldId: current.nextUpdateFieldId || 'customfield_10788',
        allowedProjectKey: current.allowedProjectKey || 'SD',
        fromName: current.fromName || 'Service Desk',
        replyToEmail: current.replyToEmail || '',
        priorityConfigs: current.priorityConfigs || [],
        monthlyTestEnabled: byId('monthlyTestEnabled').checked,
        monthlyTestHour: Number(byId('monthlyTestHour').value)
      });
      state.message = 'Monthly test settings saved.';
      await load();
    });
  };

  if (byId('contactForm')) byId('contactForm').onsubmit = async e => {
    e.preventDefault();
    const editing = state.editingId;
    await act(async () => {
      const priorities = [...document.querySelectorAll('.contact-priority:checked')].map(cb => cb.dataset.priority).filter(Boolean);
      await invoke('saveContact', {
        id: editing || undefined,
        clientOptionId: getValue('clientOptionId'),
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

  document.querySelectorAll('.test-contact').forEach(btn => btn.onclick = async () => {
    const channel = btn.dataset.channel;
    if (!confirm(`Send a TEST ${channel.toUpperCase()} to this contact?`)) return;
    await act(async () => { await invoke('testContact', { id: btn.dataset.id, channel }); state.message = `Test ${channel} sent.`; render(); });
  });
  if (byId('contactFilter')) byId('contactFilter').oninput = e => { byId('contactsHost').innerHTML = renderGroupedContacts(state.data.contacts || [], e.target.value); bindEvents(); };

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
