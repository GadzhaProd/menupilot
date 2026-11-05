import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureBuild } from '../../server/build.js';

test('build fingerprint includes scripts and third-party licenses, and skips unchanged sources', async t => {
  const root = mkdtempSync(join(tmpdir(), 'menupilot-build-'));
  t.after(() => rmSync(root, { recursive: true }));
  for (const dir of ['scripts', 'third_party/component', 'dist', 'node_modules/vite/bin']) mkdirSync(join(root, dir), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'vite.config.js', 'index.html']) writeFileSync(join(root, file), file === 'package.json' ? '{"type":"module"}' : 'fixture');
  writeFileSync(join(root, 'scripts/licenses.js'), 'first script');
  writeFileSync(join(root, 'third_party/component/LICENSE'), 'first license');
  writeFileSync(join(root, 'node_modules/vite/bin/vite.js'), `require('node:fs').writeFileSync('dist/index.html', String(Date.now()));`);
  await ensureBuild(root);
  const marker = () => readFileSync(join(root, 'dist/.menupilot-build'), 'utf8');
  let previous = marker();
  writeFileSync(join(root, 'dist/index.html'), 'untouched');
  await ensureBuild(root);
  assert.equal(readFileSync(join(root, 'dist/index.html'), 'utf8'), 'untouched');
  for (const file of ['scripts/licenses.js', 'third_party/component/LICENSE']) {
    writeFileSync(join(root, file), 'updated');
    await ensureBuild(root);
    assert.notEqual(marker(), previous, file);
    previous = marker();
  }
});
