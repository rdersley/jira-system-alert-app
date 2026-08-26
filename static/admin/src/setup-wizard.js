import { invoke } from '@forge/bridge';
import './setup-wizard.css';

const state = { data:null, open:false, step:0, busy:false, error:'', message:'' };
const steps = ['Welcome','Jira setup','Incident fields','Email','SMS','First contact','Test & finish'];
const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
const value = id => byId(id)?.value?.trim() || '';
const checked = id => Boolean(byId(id)?.checked);

function ready(){
  const d=state.data;
  return Boolean(d?.setupStatus?.jira && d?.setupStatus?.email && Number(d?.setupStatus?.contacts||0)>0);
}

function pill(ok,label){
  return `<span class="sam-w-status ${ok?'ok':'pending'}">${ok?'✓':'!'} ${esc(label)}</span>`;
}

async function loadData(){
  state.data = await invoke('getAdminData');
}

function attachHeaderButton(){
  const hero = document.querySelector('.hero');
  const version = hero?.querySelector('.version');
  if (!hero || !version || byId('samSetupHeaderButton')) return false;

  const actions = document.createElement('div');
  actions.id = 'samSetupHeaderActions';
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '10px';

  const btn = document.createElement('button');
  btn.id = 'samSetupHeaderButton';
  btn.type = 'button';
  btn.className = 'btn secondary';
  btn.textContent = 'Setup guide';
  btn.onclick = openWizard;

  version.textContent = 'v3.9.8';
  hero.replaceChild(actions, version);
  actions.appendChild(btn);
  actions.appendChild(version);
  return true;
}

function waitForHeader(){
  if (attachHeaderButton()) return;
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (attachHeaderButton() || attempts >= 80) clearInterval(timer);
  }, 250);
}

function projectOptions(selected=''){
  return `<option value="">Select a Jira project…</option>${(state.data?.jiraProjects||[]).map(p=>`<option value="${esc(p.key)}" ${p.key===selected?'selected':''}>${esc(p.name)} (${esc(p.key)})</option>`).join('')}`;
}

function fieldOptions(selected='',dateOnly=false,empty='Select a Jira field…'){
  let fields=state.data?.jiraFields||[];
  if(dateOnly) fields=fields.filter(f=>['date','datetime'].includes(String(f.schemaType||'').toLowerCase()));
  return `<option value="">${esc(empty)}</option>${fields.map(f=>`<option value="${esc(f.id)}" ${f.id===selected?'selected':''}>${esc(f.name)}${f.custom?' — Custom field':''}</option>`).join('')}`;
}

function priorityRows(){
  const rows=state.data?.settings?.priorityConfigs||[];
  return (rows.length?rows:[{name:'P1',label:'P1',color:'#AE2E24'},{name:'P2',label:'P2',color:'#B65C02'}]).map(p=>`<div class="sam-w-priority"><input class="sam-w-priority-name" value="${esc(p.name||'')}" placeholder="Jira priority"><input class="sam-w-priority-label" value="${esc(p.label||p.name||'')}" placeholder="Display label"><input class="sam-w-priority-color" type="color" value="${esc(p.color||'#0C66E4')}"></div>`).join('');
}

function collectPriorities(){
  return [...document.querySelectorAll('.sam-w-priority')].map(r=>({
    name:r.querySelector('.sam-w-priority-name')?.value?.trim()||'',
    label:r.querySelector('.sam-w-priority-label')?.value?.trim()||'',
    color:r.querySelector('.sam-w-priority-color')?.value||'#0C66E4'
  })).filter(x=>x.name);
}

async function saveCore(overrides={}){
  const s=state.data?.settings||{};
  await invoke('saveSettings',{
    clientFieldId:overrides.clientFieldId ?? s.clientFieldId ?? '',
    issueStartFieldId:overrides.issueStartFieldId ?? s.issueStartFieldId ?? '',
    nextUpdateFieldId:overrides.nextUpdateFieldId ?? s.nextUpdateFieldId ?? '',
    optionalFieldMappings:s.optionalFieldMappings||[],
    allowedProjectKey:overrides.allowedProjectKey ?? s.allowedProjectKey ?? '',
    fromName:s.fromName||'Service Desk',
    replyToEmail:s.replyToEmail||'',
    priorityConfigs:overrides.priorityConfigs ?? s.priorityConfigs ?? [],
    monthlyTestEnabled:s.monthlyTestEnabled!==false,
    monthlyTestHour:Number(s.monthlyTestHour??10)
  });
  await loadData();
}

function body(){
  const d=state.data||{}, s=d.settings||{}, p=d.providerStatus||{};
  if(state.step===0) return `<div class="sam-w-welcome"><div class="sam-w-mark">⚡</div><h2>Welcome to System Alert Manager</h2><p>This guide walks through the core setup without changing anything until you save a step.</p><div class="sam-w-summary">${pill(d.setupStatus?.jira,'Jira')}${pill(d.setupStatus?.email,'Email')}${pill(Number(d.setupStatus?.contacts||0)>0,'Contacts')}</div>${ready()?'<div class="sam-w-ready">Your existing configuration is already live. You can safely review each step.</div>':''}</div>`;
  if(state.step===1) return `<div class="sam-w-step"><h2>1. Jira setup</h2><p>Choose the Jira project, client field and priorities that can use System Alert.</p><label>Jira project<select id="samWProject">${projectOptions(d.setupStatus?.jira ? (s.allowedProjectKey||'') : '')}</select></label><label>Client / Customer field<select id="samWClientField">${fieldOptions(s.clientFieldId||'')}</select></label><div class="sam-w-section-label">Alert priorities</div><div>${priorityRows()}</div></div>`;
  if(state.step===2) return `<div class="sam-w-step"><h2>2. Incident fields</h2><p>These mappings are optional. Leave them as manual entry if the Jira site does not have matching fields.</p><label>Issue Start Time<select id="samWStartField">${fieldOptions(s.issueStartFieldId||'',true,'Manual entry only')}</select></label><label>Next Update Due<select id="samWNextField">${fieldOptions(s.nextUpdateFieldId||'',true,'Manual entry only')}</select></label></div>`;
  if(state.step===3) return `<div class="sam-w-step"><h2>3. Email</h2><p>Configure Microsoft 365 or SendGrid in Communication Providers.</p><div class="sam-w-provider-state">${pill(p.email?.configured,p.email?.configured?`${p.email.provider} ready`:'Email needs setup')}<div>${esc(p.email?.from||'No sender configured')}</div></div><button id="samWOpenProviders" class="sam-w-inline-btn" type="button">Open Communication Providers</button></div>`;
  if(state.step===4) return `<div class="sam-w-step"><h2>4. SMS</h2><p>SMS is optional and currently uses Twilio.</p><div class="sam-w-provider-state">${pill(p.sms?.configured,p.sms?.configured?'Twilio ready':'SMS not configured')}<div>${esc(p.sms?.sender||'You can skip this for now')}</div></div><button id="samWOpenSms" class="sam-w-inline-btn" type="button">Open Communication Providers</button></div>`;
  if(state.step===5){
    const clients=d.clientOptions||[], pri=s.priorityConfigs||[];
    return `<div class="sam-w-step"><h2>5. First contact</h2><p>Add a recipient for testing. Existing contacts are not modified.</p>${Number(d.setupStatus?.contacts||0)>0?`<div class="sam-w-ready">${Number(d.setupStatus.contacts)} contact${Number(d.setupStatus.contacts)===1?'':'s'} already configured. You can skip this step.</div>`:''}<label>Client<select id="samWContactClient"><option value="">Select a client…</option>${clients.map(c=>`<option value="${esc(c.optionId)}">${esc(c.value)}</option>`).join('')}</select></label><label>Contact / list name<input id="samWContactName" placeholder="Operations Team"></label><label>Email address<input id="samWContactEmail" type="email" placeholder="name@example.com"></label><label>Mobile number (optional)<input id="samWContactMobile" placeholder="+353..."></label><div class="sam-w-checks">${pri.map(x=>`<label><input class="samWContactPriority" type="checkbox" value="${esc(x.name)}" checked> ${esc(x.label||x.name)}</label>`).join('')}<label><input id="samWEmailAlerts" type="checkbox" checked> Email</label><label><input id="samWSmsAlerts" type="checkbox" ${p.sms?.configured?'checked':''}> SMS</label></div><button id="samWSaveContact" type="button" class="sam-w-inline-btn">Save contact</button></div>`;
  }
  return `<div class="sam-w-step"><h2>6. Test & finish</h2><p>Send a provider test email and confirm the installation is ready.</p><div class="sam-w-final-grid"><div>${pill(d.setupStatus?.jira,'Jira configuration')}</div><div>${pill(d.setupStatus?.email,'Email provider')}</div><div>${pill(Number(d.setupStatus?.contacts||0)>0,'Recipients')}</div><div>${pill(d.setupStatus?.sms,'SMS (optional)')}</div></div><label>Test email recipient<input id="samWTestEmail" type="email" placeholder="your.name@example.com"></label><button id="samWSendTest" type="button" class="sam-w-inline-btn" ${d.setupStatus?.email?'':'disabled'}>Send test email</button>${ready()?'<div class="sam-w-complete">✓ Core setup is complete.</div>':'<div class="sam-w-note">Complete Jira, Email and at least one Contact before going live.</div>'}</div>`;
}

function render(){
  let root=byId('samSetupRoot');
  if(!state.open){ if(root)root.remove(); return; }
  if(!root){ root=document.createElement('div'); root.id='samSetupRoot'; document.body.appendChild(root); }
  root.innerHTML=`<div class="sam-w-backdrop"><div class="sam-w-dialog"><header><div><span class="sam-w-kicker">SYSTEM ALERT MANAGER · v3.9.8</span><h1>Setup guide</h1></div><button id="samWClose" type="button">×</button></header><div class="sam-w-progress">${steps.map((x,i)=>`<button type="button" data-w-step="${i}" class="${i===state.step?'active':''} ${i<state.step?'done':''}"><span>${i===0?'•':i}</span>${esc(x)}</button>`).join('')}</div>${state.error?`<div class="sam-w-alert error">${esc(state.error)}</div>`:''}${state.message?`<div class="sam-w-alert success">${esc(state.message)}</div>`:''}<main>${body()}</main><footer><button id="samWBack" class="sam-w-secondary" type="button" ${state.step===0?'disabled':''}>Back</button><div><button id="samWExit" class="sam-w-secondary" type="button">Continue to admin</button>${state.step<steps.length-1?'<button id="samWNext" class="sam-w-primary" type="button">Save & continue</button>':'<button id="samWFinish" class="sam-w-primary" type="button">Finish setup</button>'}</div></footer></div></div>`;
  bind();
}

async function act(fn){
  if(state.busy)return;
  state.busy=true; state.error=''; state.message='';
  try{await fn();}catch(e){state.error=e?.message||String(e);}finally{state.busy=false;render();}
}

async function openWizard(){
  state.open=true; state.step=0; state.error=''; state.message='';
  let root=byId('samSetupRoot');
  if(!root){root=document.createElement('div');root.id='samSetupRoot';document.body.appendChild(root);}
  root.innerHTML='<div class="sam-w-backdrop"><div class="sam-w-dialog"><main style="display:grid;place-items:center;min-height:360px"><div><span class="spinner"></span> Loading setup guide…</div></main></div></div>';
  try{ await loadData(); render(); }catch(e){ state.error=e?.message||String(e); state.data={}; render(); }
}

function openAdmin(section){
  state.open=false; render();
  const btn=[...document.querySelectorAll('[data-section]')].find(x=>x.dataset.section===section);
  if(btn)btn.click();
}

function bind(){
  byId('samWClose').onclick=()=>{state.open=false;render();};
  byId('samWExit').onclick=()=>{state.open=false;render();};
  byId('samWBack').onclick=()=>{state.step=Math.max(0,state.step-1);state.error='';state.message='';render();};
  if(byId('samWFinish'))byId('samWFinish').onclick=()=>{state.open=false;render();};
  document.querySelectorAll('[data-w-step]').forEach(b=>b.onclick=()=>{state.step=Number(b.dataset.wStep);state.error='';state.message='';render();});
  if(byId('samWOpenProviders'))byId('samWOpenProviders').onclick=()=>openAdmin('providers');
  if(byId('samWOpenSms'))byId('samWOpenSms').onclick=()=>openAdmin('providers');
  if(byId('samWNext'))byId('samWNext').onclick=()=>act(async()=>{
    if(state.step===1){
      const pri=collectPriorities();
      if(!value('samWProject')||!value('samWClientField'))throw new Error('Choose a Jira project and Client / Customer field.');
      if(!pri.length)throw new Error('Configure at least one priority.');
      await saveCore({allowedProjectKey:value('samWProject'),clientFieldId:value('samWClientField'),priorityConfigs:pri});
    }
    if(state.step===2) await saveCore({issueStartFieldId:value('samWStartField'),nextUpdateFieldId:value('samWNextField')});
    state.step=Math.min(steps.length-1,state.step+1);
  });
  if(byId('samWSaveContact'))byId('samWSaveContact').onclick=()=>act(async()=>{
    if(!value('samWContactClient')||!value('samWContactName'))throw new Error('Choose a client and enter a contact name.');
    await invoke('saveContact',{
      clientOptionId:value('samWContactClient'),
      name:value('samWContactName'),
      email:value('samWContactEmail'),
      mobile:value('samWContactMobile'),
      priorities:[...document.querySelectorAll('.samWContactPriority:checked')].map(x=>x.value),
      emailAlerts:checked('samWEmailAlerts'),
      smsAlerts:checked('samWSmsAlerts'),
      monthlyTestAlerts:false
    });
    state.message='Contact saved.';
    await loadData();
  });
  if(byId('samWSendTest'))byId('samWSendTest').onclick=()=>act(async()=>{
    const recipient=value('samWTestEmail');
    if(!recipient)throw new Error('Enter a test email recipient.');
    await invoke('testEmailProvider',{recipient});
    state.message=`Test email sent to ${recipient}.`;
    await loadData();
  });
}

waitForHeader();
