import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const backend = fs.readFileSync('src/index.js','utf8');
const admin = fs.readFileSync('static/admin/src/main.js','utf8');

test('Microsoft 365 Enterprise flow verifies Mail.Send and uses client credentials', () => {
  assert.match(backend, /resolver\.define\(['"]verifyMicrosoftEnterpriseConnection['"]/);
  assert.match(backend, /roles\.includes\(['"]Mail\.Send['"]\)/);
  assert.match(backend, /grant_type:\s*['"]client_credentials['"]/);
  assert.match(backend, /scope:\s*['"]https:\/\/graph\.microsoft\.com\/\.default['"]/);
  assert.match(backend, /\/users\/\$\{encodeURIComponent\(sender\)\}\/sendMail/);
});

test('Microsoft 365 Enterprise UI exposes save verify and encrypted secret input', () => {
  assert.match(admin, /Save & verify Microsoft 365/);
  assert.match(admin, /Client secret VALUE/);
  assert.match(admin, /invoke\(['"]verifyMicrosoftEnterpriseConnection['"]\)/);
  assert.doesNotMatch(admin, /microsoftClientSecret[^\n]*value="[A-Za-z0-9_-]{20,}"/);
});
