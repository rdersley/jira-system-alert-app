import { readFile, writeFile } from 'node:fs/promises';

const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Invalid VERSION value: ${version}`);
}

const targets = [
  new URL('../src/index.js', import.meta.url),
  new URL('../static/admin/src/main.js', import.meta.url)
];

for (const target of targets) {
  const source = await readFile(target, 'utf8');
  const pattern = /const APP_VERSION = '[^']+';/;
  if (!pattern.test(source)) {
    throw new Error(`APP_VERSION constant not found in ${target.pathname}`);
  }
  const updated = source.replace(pattern, `const APP_VERSION = '${version}';`);
  if (updated !== source) await writeFile(target, updated, 'utf8');
}

console.log(`System Alert Manager version synced to ${version}`);
