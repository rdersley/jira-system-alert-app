import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
    const p=path.join(dir,e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  });
}

test('every frontend invoke has a backend resolver definition', () => {
  const roots=['static/admin/src','static/alert/src','static/panel/src','src/frontend'];
  const invokes=new Set();
  for (const file of roots.flatMap(filesUnder)) {
    if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
    const text=fs.readFileSync(file,'utf8');
    for (const m of text.matchAll(/invoke\(\s*['\"]([^'\"]+)['\"]/g)) invokes.add(m[1]);
  }
  const backend=fs.readFileSync('src/index.js','utf8');
  const defs=new Set([...backend.matchAll(/resolver\.define\(\s*['\"]([^'\"]+)['\"]/g)].map(m=>m[1]));
  const missing=[...invokes].filter(x=>!defs.has(x)).sort();
  assert.deepEqual(missing, [], `Missing resolver definitions: ${missing.join(', ')}`);
});
