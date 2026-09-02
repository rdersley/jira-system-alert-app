import { invoke } from '@forge/bridge';
import './contact-multiclient.css';

const collapsedGroups = new Set();

function esc(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
}

function isEditForm(form) {
  return /Save changes/i.test(form?.querySelector('button[type="submit"]')?.textContent || '');
}

function selectedClientIds(form) {
  return [...form.querySelectorAll('.sam-client-assignment:checked')].map(el => el.value).filter(Boolean);
}

function enhanceClientPicker() {
  const form = document.getElementById('contactForm');
  const select = form?.querySelector('#clientOptionId');
  if (!form || !select || form.dataset.multiClientReady === 'true' || isEditForm(form)) return;

  const options = [...select.options].filter(o => o.value);
  if (!options.length) return;
  form.dataset.multiClientReady = 'true';
  select.closest('.field')?.classList.add('sam-original-client-select');

  const wrapper = document.createElement('div');
  wrapper.className = 'field wide sam-client-picker';
  wrapper.innerHTML = `<label>Clients</label>
    <p class="help">Search and select one or more clients. The list stays compact even when the Jira Client field contains many options.</p>
    <div class="sam-client-picker-toolbar">
      <input id="samClientSearch" class="sam-client-search" type="search" placeholder="Search clients…" autocomplete="off">
      <div class="sam-client-picker-actions"><label><input type="checkbox" id="samAllClients"> All clients</label><button type="button" class="sam-client-clear">Clear</button><strong class="sam-selected-count">0 selected</strong></div>
    </div>
    <div class="sam-client-options" role="group" aria-label="Available clients">${options.map(o => `<label data-search="${esc(o.textContent.toLowerCase())}"><input class="sam-client-assignment" type="checkbox" value="${esc(o.value)}"> <span>${esc(o.textContent)}</span></label>`).join('')}</div>
    <p class="sam-client-empty" hidden>No clients match your search.</p>`;
  select.closest('.field')?.after(wrapper);

  const boxes = [...wrapper.querySelectorAll('.sam-client-assignment')];
  const labels = [...wrapper.querySelectorAll('.sam-client-options label')];
  const all = wrapper.querySelector('#samAllClients');
  const search = wrapper.querySelector('#samClientSearch');
  const count = wrapper.querySelector('.sam-selected-count');
  const clear = wrapper.querySelector('.sam-client-clear');
  const empty = wrapper.querySelector('.sam-client-empty');

  const syncOriginal = () => {
    const chosen = boxes.filter(x => x.checked);
    select.value = chosen[0]?.value || '';
    all.checked = chosen.length === boxes.length && boxes.length > 0;
    all.indeterminate = chosen.length > 0 && chosen.length < boxes.length;
    count.textContent = `${chosen.length} selected`;
    labels.forEach(label => label.classList.toggle('selected', Boolean(label.querySelector('input')?.checked)));
  };

  const applyFilter = () => {
    const q = (search.value || '').trim().toLowerCase();
    let visible = 0;
    labels.forEach(label => {
      const match = !q || label.dataset.search.includes(q);
      label.hidden = !match;
      if (match) visible += 1;
    });
    empty.hidden = visible > 0;
  };

  all.addEventListener('change', () => { boxes.forEach(x => { x.checked = all.checked; }); syncOriginal(); });
  boxes.forEach(x => x.addEventListener('change', syncOriginal));
  search.addEventListener('input', applyFilter);
  clear.addEventListener('click', () => { boxes.forEach(x => { x.checked = false; }); syncOriginal(); search.value = ''; applyFilter(); search.focus(); });

  if (select.value) {
    const current = boxes.find(x => x.value === select.value);
    if (current) current.checked = true;
  }
  syncOriginal();
}

function enhanceGroups() {
  document.querySelectorAll('#contactsHost .client-group').forEach(group => {
    const head = group.querySelector('.client-group-head');
    if (!head || head.dataset.collapseReady === 'true') return;
    head.dataset.collapseReady = 'true';
    const key = (head.querySelector('strong')?.textContent || head.textContent || '').trim();
    head.tabIndex = 0;
    head.setAttribute('role', 'button');
    head.setAttribute('aria-expanded', collapsedGroups.has(key) ? 'false' : 'true');
    const marker = document.createElement('span');
    marker.className = 'sam-collapse-marker';
    marker.textContent = collapsedGroups.has(key) ? '▸' : '▾';
    head.prepend(marker);
    const apply = () => {
      const collapsed = collapsedGroups.has(key);
      group.classList.toggle('sam-collapsed', collapsed);
      head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      marker.textContent = collapsed ? '▸' : '▾';
    };
    const toggle = () => { collapsedGroups.has(key) ? collapsedGroups.delete(key) : collapsedGroups.add(key); apply(); };
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    apply();
  });
}

function enhance() {
  enhanceClientPicker();
  enhanceGroups();
}

// Capture after the existing phone guard. For new contacts only, fan one save out
// to each selected client. Existing single-client records remain fully compatible.
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'contactForm' || isEditForm(form)) return;
  const clients = selectedClientIds(form);
  if (!clients.length) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  const payload = {
    name: form.querySelector('#name')?.value?.trim() || '',
    email: form.querySelector('#email')?.value?.trim() || '',
    mobile: form.querySelector('#mobile')?.value?.trim() || '',
    priorities: [...form.querySelectorAll('.contact-priority:checked')].map(x => x.dataset.priority).filter(Boolean),
    emailAlerts: Boolean(form.querySelector('#emailAlerts')?.checked),
    smsAlerts: Boolean(form.querySelector('#smsAlerts')?.checked),
    monthlyTestAlerts: Boolean(form.querySelector('#monthlyTestAlerts')?.checked)
  };

  try {
    let saved = 0;
    for (const clientOptionId of clients) {
      try {
        await invoke('saveContact', { ...payload, clientOptionId });
        saved += 1;
      } catch (error) {
        const message = error?.message || String(error);
        if (!/already|duplicate/i.test(message)) throw error;
      }
    }
    if (!saved) throw new Error('This contact is already assigned to all selected clients.');
    window.location.reload();
  } catch (error) {
    const box = document.createElement('div');
    box.className = 'notice error contact-guard-error wide';
    box.textContent = error?.message || String(error);
    form.prepend(box);
    if (submit) submit.disabled = false;
  }
}, true);

new MutationObserver(enhance).observe(document.documentElement, { childList:true, subtree:true });
enhance();
