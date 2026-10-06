import { invoke } from '@forge/bridge';
import { collectBackup, saveBackupFile, parseBackup, restoreBackup } from './backupClient.js';

// Backup & restore card, added to the end of the admin page (and again after each re-render).
const APP = 'System Alert Manager';
const FILE_PREFIX = 'nuvriqo-system-alert';
let pending = null;
let busy = false;
let message = { kind: '', text: '' };

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(card) {
  card.innerHTML = `<div class="card-head"><div><h2>Backup &amp; restore</h2><p>Download everything System Alert Manager stores on this site as one file (settings, templates, branding, history and contacts), or restore a backup, for example to move to another installation of the app. Email, SMS and Microsoft provider keys are never included; enter them again after a restore. The file contains contact names, emails and mobile numbers, so keep it somewhere safe.</p></div></div>
    <div class="card-body">
      <p><button class="btn primary" data-backup-download ${busy ? 'disabled' : ''}>Download backup</button></p>
      <p class="muted">Restoring writes every record in the backup and replaces records with the same key. Records that are not in the backup are kept.</p>
      <input type="file" accept="application/json,.json" data-backup-file ${busy ? 'disabled' : ''}>
      ${pending ? `<p><strong>${esc(pending.name)}</strong>: ${pending.backup.items.length.toLocaleString()} records${pending.backup.app ? ` from ${esc(pending.backup.app)}` : ''}, made ${esc(new Date(pending.backup.createdAt).toLocaleString())}.
        <button class="btn primary" data-backup-restore ${busy ? 'disabled' : ''}>Restore this backup</button> <button class="btn secondary" data-backup-cancel ${busy ? 'disabled' : ''}>Cancel</button></p>` : ''}
      ${message.text ? `<div class="notice ${message.kind}">${esc(message.text)}</div>` : ''}
    </div>`;
  card.querySelector('[data-backup-download]')?.addEventListener('click', () => run(card, async () => {
    show(card, '', 'Reading app data…');
    const backup = await collectBackup(invoke, { app: APP, onProgress: (n) => show(card, '', `Reading app data… ${n.toLocaleString()} records`) });
    saveBackupFile(backup, FILE_PREFIX);
    message = { kind: 'success', text: `Backup downloaded: ${backup.count.toLocaleString()} records.` };
  }));
  card.querySelector('[data-backup-file]')?.addEventListener('change', (event) => run(card, async () => {
    pending = null;
    const file = event.target.files?.[0];
    if (file) pending = { name: file.name, backup: parseBackup(await file.text()) };
    message = { kind: '', text: '' };
  }));
  card.querySelector('[data-backup-restore]')?.addEventListener('click', () => run(card, async () => {
    const totals = await restoreBackup(invoke, pending.backup, { onProgress: (done, total) => show(card, '', `Restoring… ${done.toLocaleString()} of ${total.toLocaleString()}`) });
    pending = null;
    message = totals.failed.length
      ? { kind: 'error', text: `Restored ${totals.restored.toLocaleString()} records; ${totals.failed.length} could not be written. Restore again to retry them.` }
      : { kind: 'success', text: `Restore finished: ${totals.restored.toLocaleString()} records restored${totals.skipped ? `, ${totals.skipped.toLocaleString()} skipped` : ''}. Reload the page to see the restored data.` };
  }));
  card.querySelector('[data-backup-cancel]')?.addEventListener('click', () => { pending = null; render(card); });
}

function show(card, kind, text) {
  message = { kind, text };
  render(card);
}

async function run(card, work) {
  busy = true; render(card);
  try { await work(); } catch (error) { message = { kind: 'error', text: error?.message || String(error) }; }
  busy = false; render(card);
}

function addBackupCard() {
  const page = document.querySelector('#app .page');
  if (!page || page.querySelector('[data-backup-tools]') || !page.querySelector('section.card')) return;
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.backupTools = 'true';
  page.appendChild(card);
  render(card);
}

new MutationObserver(() => { addBackupCard(); }).observe(document.documentElement, { childList: true, subtree: true });
addBackupCard();
