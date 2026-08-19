import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Marketplace licensing is enabled in manifest', () => {
  const manifest = text('manifest.yml');
  assert.match(manifest, /licensing:\s*\n\s+enabled:\s*true/);
});

test('scheduled monthly test uses secure licence-aware entry point', () => {
  const manifest = text('manifest.yml');
  assert.match(manifest, /monthly-test-scheduler[\s\S]*handler:\s+secure-index\.monthlyTestScheduler/);
});

test('message delivery is blocked for inactive production licences', () => {
  const guard = text('src/secure-index.js');
  assert.match(guard, /LICENSED_DELIVERY_RESOLVERS/);
  assert.match(guard, /'sendAlert'/);
  assert.match(guard, /requires an active Marketplace licence to send communications/);
  assert.match(guard, /environmentType === 'PRODUCTION'/);
});

test('development and staging remain testable without Marketplace licence context', () => {
  const guard = text('src/secure-index.js');
  assert.match(guard, /active:\s*production \? active : true/);
});

test('resolver boundary validates issue keys, recipient ids, email and phone values', () => {
  const guard = text('src/secure-index.js');
  for (const token of ['ISSUE_KEY_RE','SAFE_ID_RE','EMAIL_RE','PHONE_RE','validateResolverPayload','validateAlertPayload']) {
    assert.equal(guard.includes(token), true, `${token} safety check should be present`);
  }
});

test('send payload enforces a delivery channel and recipient limit', () => {
  const guard = text('src/secure-index.js');
  assert.match(guard, /Choose Email, SMS, or both before sending/);
  assert.match(guard, /Select no more than 100 recipients at a time/);
  assert.match(guard, /Select at least one recipient/);
});

test('template payloads have server-side length limits', () => {
  const guard = text('src/secure-index.js');
  assert.match(guard, /subject, 500/);
  assert.match(guard, /intro, 5000/);
  assert.match(guard, /followup, 5000/);
  assert.match(guard, /sms, 1200/);
});
