import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('runtime: lockfile and CI match supported engines; check includes server and mutations', () => {
  const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
  const pkg=JSON.parse(read('package.json')), lock=JSON.parse(read('package-lock.json'));
  assert.equal(pkg.engines.node,lock.packages[''].engines.node);
  for(const path of ['.github/workflows/ci.yml','.github/workflows/pages.yml']) assert.match(read(path),/node-version: '24\.15\.0'/);
  assert.match(read('AGENTS.md'),/\^24\.15\.0 \|\| \^25\.8\.1/);
  assert.match(pkg.scripts.check,/npm test/);
  assert.match(pkg.scripts.test,/npm run test:server/);assert.match(pkg.scripts.test,/npm run test:mutations/);
  assert.equal(pkg.scripts['test:mutations'],'node test/server/mutations.js');
});
