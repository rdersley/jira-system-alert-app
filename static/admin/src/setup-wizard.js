import { invoke } from '@forge/bridge';
import './setup-wizard.css';

const WIZARD_VERSION = '3.9.6';
const state = { data:null, open:false, step:0, busy:false, error:'', message:'', savedContactId:'' };
const steps = ['Welcome','Jira setup','Incident fields','Email','SMS','First contact','Test & finish'];
const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
const value = id => byId(id)?.value?.trim() || '';
const checked = id => Boolean(byId(id)?.checked);

function isReady(d){
  return Boolean(d?.setupStatus?.jira && d?.setupStatus?.email && Number(d?.setupStatus?.contacts||0)>0);
}

function patchVersionLabel(){
  document.querySelectorAll('.version').forEach(el => { el.textContent = `v${WIZARD_VERSION}`; });
}

function launcher(){
  let btn = byId('samSetupLauncher');
  if (!btn) {
    btn = document.createElement('button');
    btn.id='samSetupLauncher'; btn.type='button'; btn.className='sam-setup-launcher'; btn.textContent='Setup guide';
    btn.onclick=()=>{ state.open=true; state.step=0; render(); };
    document.body.appendChild(btn);
  }
}

async function reload(){
  state.data = await invoke('getAdminData');
  patchVersionLabel(); launcher();
}

function projectOptions(selected=''){
  return `<option value="">Select a Jira project…</option>${(state.data?.jiraProjects||[]).map(p=>`<option value="${esc(p.key)}" ${p.key===selected?'selected':''}>${esc(p.name)} (${esc(p.key)})</option>`).join('')}`;
}
function fieldOptions(selected='', dateOnly=false, empty='Select a Jira field…'){
  let fields=state.data?.jiraFields||[];
  if(dateOnly) fields=fields.filter(f=>['date','datetime'].includes(String(f.schemaType||'').toLowerCase()));
  return `<option value="">${esc(empty)}</option>${fields.map(f=>`<option value="${esc(f.id)}" ${f.id===selected?'selected':''}>${esc(f.name)}${f.custom?' — Custom field':''}</option>`).join('')}`;
}
function priorityRows(){
  const rows=state.data?.settings?.priorityConfigs||[];
  return (rows.length?rows:[{name:'P1',label:'P1',color:'#AE2E24'},{name:'P2',label:'P2',color:'#B65C02'}]).map((p,i)=>`<div class="sam-w-priority"><input class="sam-w-priority-name" value="${esc(p.name||'')}" placeholder="Jira priority"><input class="sam-w-priority-label" value="${esc(p.label||p.name||'')}" placeholder="Display label"><input class="sam-w-priority-color" type="color" value="${esc(p.color||'#0C66E4')}"></div>`).join('');
}
function collectPriorities(){
  return [...document.querySelectorAll('.sam-w-priority')].map(r=>({name:r.querySelector('.sam-w-priority-name')?.value?.trim()||'',label:r.querySelector('.sam-w-priority-label')?.value?.trim()||'',color:r.querySelector('.sam-w-priority-color')?.value||'#0C66E4'})).filter(x=>x.name);
}
async function saveCore(overrides={}){
  const s=state.data.settings||{};
  await invoke('saveSettings',{
    clientFieldId: overrides.clientFieldId ?? s.clientFieldId ?? '',
    issueStartFieldId: overrides.issueStartFieldId ?? s.issueStartFieldId ?? '',
    nextUpdateFieldId: overrides.nextUpdateFieldId ?? s.nextUpdateFieldId ?? '',
    optionalFieldMappings: s.optionalFieldMappings||[],
    allowedProjectKey: overrides.allowedProjectKey ?? s.allowedProjectKey ?? '',
    fromName:s.fromName||'Service Desk', replyToEmail:s.replyToEmail||'',
    priorityConfigs:overrides.priorityConfigs ?? s.priorityConfigs ?? [],
    monthlyTestEnabled:s.monthlyTestEnabled!==false, monthlyTestHour:Number(s.monthlyTestHour??10)
  });
  await reload();
}

function statusPill(ok,label){ return `<span class="sam-w-status ${ok?'ok':'pending'}">${ok?'✓':'!'} ${esc(label)}</span>`; }
function stepBody(){
  const d=state.data||{}, s=d.settings||{}, p=d.providerStatus||{};
  if(state.step===0) return `<div class="sam-w-welcome"><div class="sam-w-mark">⚡</div><h2>Welcome to System Alert Manager</h2><p>This guided setup gets a new Jira site ready for customer incident communications without needing to understand Forge or custom field IDs.</p><div class="sam-w-summary">${statusPill(d.setupStatus?.jira,'Jira')}${statusPill(d.setupStatus?.email,'Email')}${statusPill(Number(d.setupStatus?.contacts||0)>0,'Contacts')}</div>${isReady(d)?'<div class="sam-w-ready">Your existing configuration is already live. You can still walk through the guide without resetting anything.</div>':''}</div>`;
  if(state.step===1) return `<div class="sam-w-step"><h2>1. Jira setup</h2><p>Choose where System Alert is available and how the app identifies the customer on a ticket.</p><label>Jira project<select id="samWProject">${projectOptions(s.allowedProjectKey||'')}</select></label><label>Client / Customer field<select id="samWClientField">${fieldOptions(s.clientFieldId||'')}</select></label><div class="sam-w-section-label">Alert priorities</div><p class="sam-w-help">These names must match Jira exactly. You can change the customer-facing label and colour.</p><div id="samWPriorityRows">${priorityRows()}</div></div>`;
  if(state.step===2) return `<div class="sam-w-step"><h2>2. Incident fields</h2><p>These mappings are optional. If a site does not have these Jira fields, agents can type the values manually when sending an alert.</p><label>Issue Start Time<select id="samWStartField">${fieldOptions(s.issueStartFieldId||'',true,'Manual entry only')}</select></label><label>Next Update Due<select id="samWNextField">${fieldOptions(s.nextUpdateFieldId||'',true,'Manual entry only')}</select></label><div class="sam-w-note">Additional incident fields and template tokens can be configured later under <b>General</b>.</div></div>`;
  if(state.step===3) return `<div class="sam-w-step"><h2>3. Email</h2><p>System Alert can use Microsoft 365 or SendGrid. Provider credentials stay encrypted and are never shown again after saving.</p><div class="sam-w-provider-state">${statusPill(p.email?.configured, p.email?.configured?`${p.email.provider} ready`:'Email needs setup')}<div>${p.email?.from?`Sender: ${esc(p.email.from)}`:'No sender configured yet.'}</div></div><div class="sam-w-choice"><button type="button" data-open-section="providers" class="sam-w-choice-card"><strong>Microsoft 365</strong><span>Use an existing Exchange Online mailbox via Microsoft Graph.</span></button><button type="button" data-open-section="providers" class="sam-w-choice-card"><strong>SendGrid</strong><span>Use an API key and verified sender address.</span></button></div><p class="sam-w-help">Use “Configure email provider” to open the full provider screen. Return to Setup guide afterwards and continue where you left off.</p><button id="samWOpenProviders" type="button" class="sam-w-inline-btn">Configure email provider</button></div>`;
  if(state.step===4) return `<div class="sam-w-step"><h2>4. SMS</h2><p>SMS is optional. If you use it, System Alert currently supports Twilio.</p><div class="sam-w-provider-state">${statusPill(p.sms?.configured,p.sms?.configured?'Twilio ready':'SMS not configured')}<div>${p.sms?.sender?`Sender: ${esc(p.sms.sender)}`:'You can skip SMS and add it later.'}</div></div><button id="samWOpenSms" type="button" class="sam-w-inline-btn">Configure Twilio</button></div>`;
  if(state.step===5){
    const clients=d.clientOptions||[]; const pri=s.priorityConfigs||[];
    return `<div class="sam-w-step"><h2>5. First contact</h2><p>Add at least one recipient so you can send a test alert. Existing contacts are not changed.</p>${Number(d.setupStatus?.contacts||0)>0?`<div class="sam-w-ready">${Number(d.setupStatus.contacts)} contact${Number(d.setupStatus.contacts)===1?'':'s'} already configured. You can skip this step.</div>`:''}<label>Client<select id="samWContactClient"><option value="">Select a client…</option>${clients.map(c=>`<option value="${esc(c.optionId)}">${esc(c.value)}</option>`).join('')}</select></label><label>Contact / list name<input id="samWContactName" placeholder="Operations Team"></label><label>Email address<input id="samWContactEmail" type="email" placeholder="name@example.com"></label><label>Mobile number (optional)<input id="samWContactMobile" placeholder="+353..."></label><div class="sam-w-checks">${pri.map(x=>`<label><input class="samWContactPriority" type="checkbox" value="${esc(x.name)}" checked> ${esc(x.label||x.name)}</label>`).join('')}<label><input id="samWEmailAlerts" type="checkbox" checked> Email</label><label><input id="samWSmsAlerts" type="checkbox" ${p.sms?.configured?'checked':''}> SMS</label></div><button id="samWSaveContact" type="button" class="sam-w-inline-btn">Save contact</button></div>`;
  }
  return `<div class="sam-w-step"><h2>6. Test & finish</h2><p>Run a provider test, then start using System Alert from an enabled Jira ticket.</p><div class="sam-w-final-grid"><div>${statusPill(d.setupStatus?.jira,'Jira configuration')}<p>Project, customer field and priorities.</p></div><div>${statusPill(d.setupStatus?.email,'Email provider')}<p>${esc(p.email?.provider||'Not configured')}</p></div><div>${statusPill(Number(d.setupStatus?.contacts||0)>0,'Recipients')}<p>${Number(d.setupStatus?.contacts||0)} saved contact${Number(d.setupStatus?.contacts||0)===1?'':'s'}.</p></div><div>${statusPill(d.setupStatus?.sms,'SMS (optional)')}<p>${d.setupStatus?.sms?'Twilio ready':'Can be added later.'}</p></div></div><label>Test email recipient<input id="samWTestEmail" type="email" placeholder="your.name@example.com"></label><button id="samWSendTest" type="button" class="sam-w-inline-btn" ${d.setupStatus?.email?'':'disabled'}>Send test email</button>${isReady(d)?'<div class="sam-w-complete">✓ Core setup is complete. System Alert Manager is ready for live incident testing.</div>':'<div class="sam-w-note">Complete Jira, Email and at least one Contact before going live.</div>'}</div>`;
}

function render(){
  patchVersionLabel(); launcher();
  let root=byId('samSetupRoot');
  if(!state.open){ if(root)root.remove(); return; }
  if(!root){root=document.createElement('div');root.id='samSetupRoot';document.body.appendChild(root);}
  root.innerHTML=`<div class="sam-w-backdrop"><div class="sam-w-dialog"><header><div><span class="sam-w-kicker">SYSTEM ALERT MANAGER · v${WIZARD_VERSION}</span><h1>Setup guide</h1></div><button id="samWClose" type="button" aria-label="Close">×</button></header><div class="sam-w-progress">${steps.map((x,i)=>`<button type="button" data-w-step="${i}" class="${i===state.step?'active':''} ${i<state.step?'done':''}"><span>${i===0?'•':i}</span>${esc(x)}</button>`).join('')}</div>${state.error?`<div class="sam-w-alert error">${esc(state.error)}</div>`:''}${state.message?`<div class="sam-w-alert success">${esc(state.message)}</div>`:''}<main>${stepBody()}</main><footer><button id="samWBack" type="button" class="sam-w-secondary" ${state.step===0?'disabled':''}>Back</button><div><button id="samWExit" type="button" class="sam-w-secondary">Continue to admin</button>${state.step<steps.length-1?'<button id="samWNext" type="button" class="sam-w-primary">Save & continue</button>':'<button id="samWFinish" type="button" class="sam-w-primary">Finish setup</button>'}</div></footer></div></div>`;
  bind();
}

async function act(fn){ if(state.busy)return; state.busy=true; state.error=''; state.message=''; try{await fn();}catch(e){state.error=e?.message||String(e);}finally{state.busy=false;render();} }
async function next(){
  await act(async()=>{
    if(state.step===1){ if(!value('samWProject')||!value('samWClientField')) throw new Error('Choose a Jira project and Client / Customer field.'); const pri=collectPriorities(); if(!pri.length)throw new Error('Configure at least one alert priority.'); await saveCore({allowedProjectKey:value('samWProject'),clientFieldId:value('samWClientField'),priorityConfigs:pri}); }
    if(state.step===2) await saveCore({issueStartFieldId:value('samWStartField'),nextUpdateFieldId:value('samWNextField')});
    await reload(); state.step=Math.min(steps.length-1,state.step+1);
  });
}
function openAdmin(section){ state.open=false; render(); const btn=[...document.querySelectorAll('[data-section]')].find(x=>x.dataset.section===section); if(btn)btn.click(); }
function bind(){
  byId('samWClose').onclick=()=>{state.open=false;render();}; byId('samWExit').onclick=()=>{state.open=false;render();};
  byId('samWBack').onclick=()=>{state.step=Math.max(0,state.step-1);state.error='';state.message='';render();};
  if(byId('samWNext'))byId('samWNext').onclick=next;
  if(byId('samWFinish'))byId('samWFinish').onclick=()=>{state.open=false;render();};
  document.querySelectorAll('[data-w-step]').forEach(b=>b.onclick=()=>{state.step=Number(b.dataset.wStep);state.error='';state.message='';render();});
  document.querySelectorAll('[data-open-section="providers"]').forEach(b=>b.onclick=()=>openAdmin('providers'));
  if(byId('samWOpenProviders'))byId('samWOpenProviders').onclick=()=>openAdmin('providers');
  if(byId('samWOpenSms'))byId('samWOpenSms').onclick=()=>openAdmin('providers');
  if(byId('samWSaveContact'))byId('samWSaveContact').onclick=()=>act(async()=>{
    if(!value('samWContactClient')||!value('samWContactName'))throw new Error('Choose a client and enter a contact name.');
    const priorities=[...document.querySelectorAll('.samWContactPriority:checked')].map(x=>x.value);
    const saved=await invoke('saveContact',{clientOptionId:value('samWContactClient'),name:value('samWContactName'),email:value('samWContactEmail'),mobile:value('samWContactMobile'),priorities,emailAlerts:checked('samWEmailAlerts'),smsAlerts:checked('samWSmsAlerts'),monthlyTestAlerts:false});
    state.savedContactId=saved?.id||''; state.message='Contact saved.'; await reload();
  });
  if(byId('samWSendTest'))byId('samWSendTest').onclick=()=>act(async()=>{const recipient=value('samWTestEmail');if(!recipient)throw new Error('Enter a test email recipient.');await invoke('testEmailProvider',{recipient});state.message=`Test email sent to ${recipient}.`;await reload();});
}

async function init(){
  await reload();
  const existingConfigured = isReady(state.data);
  state.open = !existingConfigured;
  if(existingConfigured) launcher();
  render();
  const observer=new MutationObserver(()=>{patchVersionLabel();launcher();});
  observer.observe(document.body,{childList:true,subtree:true});
}

init().catch(err=>{console.error('Setup wizard failed to initialize',err); launcher();});
