import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const version = text('VERSION').trim();

test('fresh install does not expose System Alert through an SD/P1/P2 manifest fallback', () => {
  const manifest = text('manifest.yml');
  assert.equal(manifest.includes("app.properties['system-alert-display'] == null"), false);
  assert.equal(manifest.includes("project.key == 'SD'"), false);
  assert.equal(manifest.includes("app.properties['system-alert-display'] != null"), true);
});

test('fresh install admin data is scrubbed of customer-specific assumptions', () => {
  const hardened = text('src/secure-index.js');
  assert.match(hardened, /storedSettings\s*=\s*await kvs\.get\(SETTINGS_KEY\)/);
  assert.match(hardened, /allowedProjectKey:\s*''/);
  assert.match(hardened, /clientFieldId:\s*''/);
  assert.match(hardened, /replyToEmail:\s*''/);
  assert.match(hardened, /priorityConfigs:\s*\[\]/);
  assert.match(hardened, /optionalFieldMappings:\s*\[\]/);
});

test('Forge runtime uses the tested hardened entry point without a second Resolver monkey-patch layer', () => {
  const manifest = text('manifest.yml');
  assert.match(manifest, /handler:\s+secure-index\.handler/);
  assert.match(manifest, /handler:\s+secure-index\.monthlyTestScheduler/);
  assert.equal(manifest.includes('final-index.handler'), false);
  assert.equal(manifest.includes('final-index.monthlyTestScheduler'), false);
});

test('release version markers stay aligned', () => {
  const rootPackage = JSON.parse(text('package.json'));
  const adminPackage = JSON.parse(text('static/admin/package.json'));
  const setupWizard = text('static/admin/src/setup-wizard.js');
  assert.equal(rootPackage.version, version);
  assert.equal(adminPackage.version, version);
  assert.match(setupWizard, new RegExp(`v${version.replaceAll('.', '\\.')}`));
});

test('provider secrets are never declared as plaintext defaults', () => {
  const backend = text('src/index.js');
  for (const secretName of ['sendgridApiKey','twilioAuthToken','twilioApiSecret','microsoftClientSecret']) {
    assert.match(backend, new RegExp(`getProviderSecret\\('${secretName}'\\)`));
  }
  assert.equal(/(?:SG\.[A-Za-z0-9_-]{20,}|SK[a-fA-F0-9]{20,}|client_secret\s*[:=]\s*['\"][^'\"]{12,})/.test(backend), false);
});
