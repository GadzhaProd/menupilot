import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, mkdirSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, canonicalDataDir, processIdentity } from '../../server/lock.js';
function fixture(t) { const dir=mkdtempSync(join(tmpdir(),'menupilot-lock-')); t.after(()=>rmSync(dir,{recursive:true})); return dir; }
const old = path => utimesSync(path, new Date(0), new Date(0));
test('lock: living unresponsive owner is kept; canonical alias; only owner releases', async t => {
  const dir=fixture(t), data=canonicalDataDir(join(dir,'data'));
  symlinkSync(data,join(dir,'alias')); assert.equal(canonicalDataDir(join(dir,'alias')),data);
  const lock=await acquireLock(data,'http://127.0.0.1:1');
  await assert.rejects(acquireLock(data,'http://127.0.0.1:2',{waitMs:0}),error=>{
    assert.equal(error.code,'lock-uncertain'); assert.match(error.message,/looks stale/);
    assert.ok(error.message.includes(data) && error.message.includes(join(data,'lock')));
    assert.match(error.message,/run npm start again/); return true;
  });
  writeFileSync(join(data,'lock'),JSON.stringify({...lock.owner,instanceId:'another'}));
  assert.equal(await lock.release(),false);
  assert.equal(JSON.parse(readFileSync(join(data,'lock'))).instanceId,'another');
});
test('lock: dead PID, reused PID and previous boot are recoverable', async t => {
  const dir=fixture(t), identity=processIdentity(process.pid);
  for(const owner of [
    {pid:2147483647}, {pid:process.pid,...identity,processStart:'different start'},
    {pid:process.pid,...identity,bootId:'previous boot'},
  ]) {
    writeFileSync(join(dir,'lock'),JSON.stringify({instanceId:'stale',address:'http://127.0.0.1:1',...owner}));
    const lock=await acquireLock(dir,'http://127.0.0.1:2'); assert.ok(await lock.release());
  }
});
test('lock: old empty/malformed lock recovers; fresh incomplete lock is kept', async t => {
  const dir=fixture(t), path=join(dir,'lock');
  for(const contents of ['', '{partial', 'null']) {
    writeFileSync(path,contents);
    await assert.rejects(acquireLock(dir,'http://127.0.0.1:1',{waitMs:0}),{code:'lock-busy'});
    old(path); const lock=await acquireLock(dir,'http://127.0.0.1:1'); assert.ok(await lock.release());
  }
});
test('lock: stale empty guard recovers, live owned guard is never evicted by age', async t => {
  const dir=fixture(t), guard=join(dir,'lock.guard'); mkdirSync(guard); old(guard);
  const lock=await acquireLock(dir,'http://127.0.0.1:1'); assert.ok(await lock.release());
  mkdirSync(guard);writeFileSync(join(guard,'owner'),JSON.stringify(lock.owner));old(guard);
  await assert.rejects(acquireLock(dir,'http://127.0.0.1:1',{waitMs:0}),error=>{
    assert.equal(error.code,'lock-busy');assert.ok(error.message.includes(guard));return true;
  });
});
test('lock: release retries contention and cleanup failures never reject', async t => {
  const dir=fixture(t), guard=join(dir,'lock.guard');
  const lock=await acquireLock(dir,'http://127.0.0.1:1');mkdirSync(guard);
  const timer=setTimeout(()=>rmSync(guard,{recursive:true}),50);t.after(()=>clearTimeout(timer));
  assert.ok(await lock.release());assert.equal(existsSync(join(dir,'lock')),false);
  const next=await acquireLock(dir,'http://127.0.0.1:1');mkdirSync(guard);
  const messages=[];t.mock.method(console,'error',m=>messages.push(m));
  assert.equal(await next.release(),false);assert.equal(messages.length,1);
  assert.ok(messages[0].includes(join(dir,'lock')));assert.ok(existsSync(join(dir,'lock')));
});

test('lock: HTTP probe must identify MenuPilot and the same instance', async t => {
  const { createServer }=await import('node:http');
  const dir=fixture(t);let body={service:'MenuPilot',instanceId:'different'};
  const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const address=`http://127.0.0.1:${server.address().port}`;
  const lock=await acquireLock(dir,address);
  for(const value of [body,{service:'Other',instanceId:lock.owner.instanceId}]) {
    body=value;
    await assert.rejects(acquireLock(dir,address,{waitMs:0}),{code:'lock-uncertain',message:/looks stale/});
  }
  body={service:'MenuPilot',instanceId:lock.owner.instanceId};
  await assert.rejects(acquireLock(dir,address,{waitMs:0}),{code:'already-running',message:/npm run menupilot -- open-url/});
  assert.ok(await lock.release());
});
