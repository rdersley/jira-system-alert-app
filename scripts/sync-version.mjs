import { readFile, writeFile } from 'node:fs/promises';

const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Invalid VERSION value: ${version}`);
}

const sourceTargets = [
  new URL('../src/index.js', import.meta.url),
  new URL('../static/admin/src/main.js', import.meta.url)
];

for (const target of sourceTargets) {
  const source = await readFile(target, 'utf8');
  const pattern = /const APP_VERSION = '[^']+';/;
  if (!pattern.test(source)) {
    throw new Error(`APP_VERSION constant not found in ${target.pathname}`);
  }
  const updated = source.replace(pattern, `const APP_VERSION = '${version}';`);
  if (updated !== source) await writeFile(target, updated, 'utf8');
}

// The setup wizard previously carried separate hard-coded version labels.
// Keep all visible wizard labels aligned with the release VERSION too.
const wizardTarget = new URL('../static/admin/src/setup-wizard.js', import.meta.url);
const wizardSource = await readFile(wizardTarget, 'utf8');
const wizardUpdated = wizardSource.replace(/v\d+\.\d+\.\d+/g, `v${version}`);
if (wizardUpdated !== wizardSource) await writeFile(wizardTarget, wizardUpdated, 'utf8');

const packageTargets = [
  new URL('../package.json', import.meta.url),
  new URL('../static/admin/package.json', import.meta.url),
  new URL('../static/alert/package.json', import.meta.url),
  new URL('../static/panel/package.json', import.meta.url)
];

for (const target of packageTargets) {
  const pkg = JSON.parse(await readFile(target, 'utf8'));
  if (pkg.version !== version) {
    pkg.version = version;
    await writeFile(target, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
}

console.log(`System Alert Manager version synced to ${version}`);
