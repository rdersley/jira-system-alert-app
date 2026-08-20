import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function adminResolverBlock(guard) {
  const start = guard.indexOf('const ADMIN_RESOLVERS');
  const end = guard.indexOf('const LICENSED_DELIVERY_RESOLVERS');
  assert.notEqual(start, -1, 'ADMIN_RESOLVERS declaration should exist');
  assert.notEqual(end, -1, 'LICENSED_DELIVERY_RESOLVERS declaration should exist');
  assert.ok(end > start, 'ADMIN_RESOLVERS block should end before licensed delivery resolvers');
  return guard.slice(start, end);
}

test('Forge runtime points directly at a callable hardened entry point', () => {
  const manifest = text('manifest.yml');
  assert.match(manifest, /handler:\s+secure-index\.handler/);
  assert.match(manifest, /handler:\s+secure-index\.monthlyTestScheduler/);
  const guard = text('src/secure-index.js');
  assert.match(guard, /function loadApp\(\)/);
  assert.match(guard, /appPromise = import\('\.\/index\.js'\)/);
  assert.match(guard, /export async function handler\(\.\.\.args\)/);
  assert.match(guard, /return app\.handler\(\.\.\.args\)/);
  assert.match(guard, /export async function monthlyTestScheduler\(\.\.\.args\)/);
  assert.equal(/const app = await import\('\.\/index\.js'\)/.test(guard), false, 'top-level await must not be used by the Forge entry point');
});

test('admin guard checks Jira ADMINISTER permission', () => {
  const guard = text('src/secure-index.js');
  assert.match(guard, /mypermissions\?permissions=ADMINISTER/);
  assert.match(guard, /permissions\?\.ADMINISTER\?\.havePermission !== true/);
});

test('ticket alert resolvers remain outside the admin-only set', () => {
  const guard = text('src/secure-index.js');
  const adminSet = adminResolverBlock(guard);
  for (const key of ['getIssueAlertData','previewEmail','sendAlert']) {
    assert.equal(adminSet.includes(`'${key}'`), false, `${key} must remain usable by authorised Jira agents`);
  }
});

test('sensitive configuration resolvers are admin-only', () => {
  const guard = text('src/secure-index.js');
  const adminSet = adminResolverBlock(guard);
  for (const key of ['getAdminData','saveSettings','saveProviderSettings','saveMicrosoftMarketplaceSettings','saveTemplates','saveBranding','saveContact','deleteContact']) {
    assert.equal(adminSet.includes(`'${key}'`), true, `${key} should require Jira administrator permission`);
  }
});
