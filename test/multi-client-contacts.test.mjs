import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enhancement = await readFile(new URL('../static/admin/src/contact-multiclient.js', import.meta.url), 'utf8');
const entry = await readFile(new URL('../static/admin/src/entry.js', import.meta.url), 'utf8');

test('admin loads the multi-client contact enhancement', () => {
  assert.match(entry, /contact-multiclient\.js/);
});

test('new contacts can be assigned to multiple clients', () => {
  assert.match(enhancement, /sam-client-assignment/);
  assert.match(enhancement, /All clients/);
  assert.match(enhancement, /for \(const clientOptionId of clients\)/);
  assert.match(enhancement, /invoke\('saveContact'/);
});

test('existing contact edit flow stays backward compatible', () => {
  assert.match(enhancement, /isEditForm\(form\)/);
  assert.match(enhancement, /Existing single-client records remain fully compatible/);
});

test('client groups are collapsible and keyboard accessible', () => {
  assert.match(enhancement, /aria-expanded/);
  assert.match(enhancement, /sam-collapsed/);
  assert.match(enhancement, /e\.key === 'Enter'/);
});
