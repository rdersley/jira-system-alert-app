import { invoke } from '@forge/bridge';
import './contact-multiclient.css';

const collapsedGroups = new Set();

function esc(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    <p class="help">Search for a client and add it. Only selected clients stay visible, so this remains tidy even with a large Jira Client list.</p>
    <div class="sam-client-combobox">
      <div class="sam-client-search-row">
        <input id="samClientSearch" class="sam-client-search" type="search" placeholder="Search client code or name…" autocomplete="off" aria-expanded="false" aria-controls="samClientResults">
        <label class="sam-all-clients-toggle"><input type="checkbox" id="samAllClients"> <span>All clients</span></label>
      </div>
      <div id="samClientResults" class="sam-client-results" hidden></div>
    </div>
    <div class="sam-selection-summary">
      <div class="sam-selected-heading"><span>Selected clients</span><strong class="sam-selected-count">0</strong></div>
      <div class="sam-selected-chips"><span class="sam-selected-empty">No clients selected yet.</span></div>
      <button type="button" class="sam-client-clear" hidden>Clear selection</button>
    </div>
    <div class="sam-client-checkbox-store" aria-hidden="true">${options.map(o => `<label><input class="sam-client-assignment" type="checkbox" value="${esc(o.value)}" data-label="${esc(o.textContent)}" data-search="${esc(o.textContent.toLowerCase())}"></label>`).join('')}</div>`;
  select.closest('.field')?.after(wrapper);

  const boxes = [...wrapper.querySelectorAll('.sam-client-assignment')];
  const all = wrapper.querySelector('#samAllClients');
  const search = wrapper.querySelector('#samClientSearch');
  const results = wrapper.querySelector('#samClientResults');
  const chips = wrapper.querySelector('.sam-selected-chips');
  const count = wrapper.querySelector('.sam-selected-count');
  const clear = wrapper.querySelector('.sam-client-clear');

  const renderSelected = () => {
    const chosen = boxes.filter(x => x.checked);
    select.value = chosen[0]?.value || '';
    all.checked = chosen.length === boxes.length && boxes.length > 0;
    all.indeterminate = chosen.length > 0 && chosen.length < boxes.length;
    count.textContent = String(chosen.length);
    clear.hidden = chosen.length === 0;
    if (!chosen.length) {
      chips.innerHTML = '<span class="sam-selected-empty">No clients selected yet.</span>';
      return;
    }
    chips.innerHTML = chosen.map(box => `<button type="button" class="sam-client-chip" data-value="${esc(box.value)}" title="Remove ${esc(box.dataset.label || '')}"><span>${esc(box.dataset.label || box.value)}</span><span aria-hidden="true">×</span></button>`).join('');
    chips.querySelectorAll('.sam-client-chip').forEach(chip => chip.addEventListener('click', () => {
      const box = boxes.find(x => x.value === chip.dataset.value);
      if (box) box.checked = false;
      renderSelected();
      renderResults();
    }));
  };

  const renderResults = () => {
    const q = (search.value || '').trim().toLowerCase();
    if (!q) {
      results.hidden = true;
      results.innerHTML = '';
      search.setAttribute('aria-expanded', 'false');
      return;
    }
    const matches = boxes.filter(box => !box.checked && box.dataset.search.includes(q)).slice(0, 10);
    results.hidden = false;
    search.setAttribute('aria-expanded', 'true');
    results.innerHTML = matches.length
      ? matches.map(box => `<button type="button" class="sam-client-result" data-value="${esc(box.value)}"><span>${esc(box.dataset.label || box.value)}</span><span class="sam-result-add">Add</span></button>`).join('')
      : '<div class="sam-client-no-results">No matching clients.</div>';
    results.querySelectorAll('.sam-client-result').forEach(button => button.addEventListener('click', () => {
      const box = boxes.find(x => x.value === button.dataset.value);
      if (box) box.checked = true;
      search.value = '';
      renderSelected();
      renderResults();
      search.focus();
    }));
  };

  all.addEventListener('change', () => {
    boxes.forEach(x => { x.checked = all.checked; });
    renderSelected();
    search.value = '';
    renderResults();
  });
  search.addEventListener('input', renderResults);
  search.addEventListener('focus', renderResults);
  clear.addEventListener('click', () => {
    boxes.forEach(x => { x.checked = false; });
    search.value = '';
    renderSelected();
    renderResults();
    search.focus();
  });
  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) {
      results.hidden = true;
      search.setAttribute('aria-expanded', 'false');
    }
  });

  if (select.value) {
    const current = boxes.find(x => x.value === select.value);
    if (current) current.checked = true;
  }
  renderSelected();
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
