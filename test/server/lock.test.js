import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, canonicalDataDir } from '../../server/lock.js';
function fixture(t) { const dir=mkdtempSync(join(tmpdir(),'menupilot-lock-')); t.after(()=>rmSync(dir,{recursive:true})); return dir; }
test('lock: refuses a living process, including canonical alias; only the owner releases', t => {
  const dir=fixture(t), data=canonicalDataDir(join(dir,'data'));
  symlinkSync(data,join(dir,'alias'));
  assert.equal(canonicalDataDir(join(dir,'alias')),data);
  const lock=acquireLock(data,'http://127.0.0.1:4710');
  assert.throws(()=>acquireLock(data,'http://127.0.0.1:4711'),{code:'already-running',message:/4710/});
  writeFileSync(join(data,'lock'),JSON.stringify({...lock.owner,instanceId:'another'}));
  assert.equal(lock.release(),false);
  assert.equal(JSON.parse(readFileSync(join(data,'lock'))).instanceId,'another');
});
test('lock: definitely dead PID is recoverable; corrupt/uncertain locks fail closed', t => {
  const dir=canonicalDataDir(fixture(t));
  writeFileSync(join(dir,'lock'),JSON.stringify({pid:2147483647,instanceId:'dead',address:'http://127.0.0.1:4710'}));
  const lock=acquireLock(dir,'http://127.0.0.1:4711'); assert.ok(lock.release());
  writeFileSync(join(dir,'lock'),'{partial');
  assert.throws(()=>acquireLock(dir,'http://127.0.0.1:4711'),{code:'lock-uncertain'});
});
