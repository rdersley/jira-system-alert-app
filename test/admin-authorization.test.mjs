import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('resolver entry point is protected by final release and admin guards', () => {
  const manifest = text('manifest.yml');
  assert.match(manifest, /handler:\s+final-index\.handler/);
  const releaseGuard = text('src/final-index.js');
  assert.match(releaseGuard, /await import\('\.\/secure-index\.js'\)/);
});

test('admin guard checks Jira ADMINISTER permission', () => {
  const guard = text('src/secure-index.js');
  assert.match(guard, /mypermissions\?permissions=ADMINISTER/);
  assert.match(guard, /permissions\?\.ADMINISTER\?\.havePermission !== true/);
});

test('ticket alert resolvers remain outside the admin-only set', () => {
  const guard = text('src/secure-index.js');
  for (const key of ['getIssueAlertData','previewEmail','sendAlert']) {
    const adminSet = guard.slice(guard.indexOf('const ADMIN_RESOLVERS'), guard.indexOf('async function requireJiraAdmin'));
    assert.equal(adminSet.includes(`'${key}'`), false, `${key} must remain usable by authorised Jira agents`);
  }
});

test('sensitive configuration resolvers are admin-only', () => {
  const guard = text('src/secure-index.js');
  const adminSet = guard.slice(guard.indexOf('const ADMIN_RESOLVERS'), guard.indexOf('async function requireJiraAdmin'));
  for (const key of ['getAdminData','saveSettings','saveProviderSettings','saveMicrosoftMarketplaceSettings','saveTemplates','saveBranding','saveContact','deleteContact']) {
    assert.equal(adminSet.includes(`'${key}'`), true, `${key} should require Jira administrator permission`);
  }
});
