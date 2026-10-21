import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('security documentation states local DoS, browser-history retention and full leaked-token access', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const architecture = readFileSync(new URL('../../docs/planning/03_ARCHITECTURE.md', import.meta.url), 'utf8');
  assert.match(readme, /Local DoS remains possible/);
  assert.match(readme, /not\*\* guarantee erasure from browser history or sync/);
  assert.match(readme, /leaked UI token grants full read\/write/);
  assert.match(architecture, /Local DoS всё ещё возможен/);
  assert.match(architecture, /гарантии удаления из browser history или sync нет/);
  assert.match(architecture, /утечка UI token даёт полный доступ/);
});
