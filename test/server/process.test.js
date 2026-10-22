import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, statSync, realpathSync, mkdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { assertRuntime } from '../../server/runtime.js';

export async function unusedPort() {
  const s=createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r));
  const port=s.address().port; await new Promise(r=>s.close(r)); return port;
}
export function launch(dir,port) {
  const child=spawn(process.execPath,['server/start.js'],{env:{...process.env,MENUPILOT_DATA_DIR:dir,MENUPILOT_PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let output=''; child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  return {child,output:()=>output};
}
async function ready(p) {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('startup timeout: '+p.output())),30000);
    p.child.stdout.on('data',()=>{if(p.output().includes('MenuPilot: http')){clearTimeout(timer);resolve();}});
    p.child.once('exit',code=>{clearTimeout(timer);reject(new Error('server exit '+code+': '+p.output()));});
  });
}
async function stop(p) { if(p.child.exitCode!==null || p.child.signalCode!==null)return; const ended=once(p.child,'exit');p.child.kill('SIGTERM');await ended; }

test('runtime: rejects unsupported releases with actionable guidance',()=>{
  for(const v of ['20.19.0','22.13.0','24.14.0','25.0.0','25.8.0','26.0.0','24.15.0-rc.1','bad'])assert.throws(()=>assertRuntime(v),/>=24.15.0 <25.0.0 OR >=25.8.1 <26.0.0/);
  for(const v of ['24.15.0','24.16.0','25.8.1'])assert.doesNotThrow(()=>assertRuntime(v));
});
test('process: second server refuses before opening DB; SIGTERM releases; killed owner can restart', {timeout:90000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'menupilot-process-')),port=await unusedPort();
  const children=[];t.after(async()=>{for(const p of children)await stop(p);rmSync(dir,{recursive:true});});
  const first=launch(dir,port);children.push(first);await ready(first);
  assert.equal(statSync(join(dir,'token')).mode&0o777,0o600);
  const token=readFileSync(join(dir,'token'),'utf8');
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/document`,{headers:{Authorization:`Bearer ${token}`}})).status,200);
  const second=launch(dir,await unusedPort());children.push(second);const [code]=await once(second.child,'exit');
  assert.equal(code,1);assert.match(second.output(),new RegExp(`already running at http://127.0.0.1:${port}`));
  assert.match(second.output(), /to open it run npm run menupilot -- open-url/);
  await stop(first);assert.throws(()=>statSync(join(dir,'lock')),{code:'ENOENT'});
  const third=launch(dir,port);children.push(third);await ready(third);
  const ended=once(third.child,'exit');third.child.kill('SIGKILL');await ended;
  const fourth=launch(dir,port);children.push(fourth);await ready(fourth);await stop(fourth);
});

test('process: CLI stop waits for writes, creates shutdown backup, releases lock, and reports JSON', {timeout:90000},async t=>{
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  const dir=mkdtempSync(join(tmpdir(),'menupilot-stop-')),port=await unusedPort();
  const server=launch(dir,port);
  t.after(async()=>{await stop(server);rmSync(dir,{recursive:true});});
  await ready(server);
  const openUrl=server.output().match(/http:\/\/127\.0\.0\.1:\d+\/menupilot\/#k=[a-f0-9]+/)?.[0];
  const address=openUrl?.match(/^http:\/\/127\.0\.0\.1:\d+/)?.[0];
  const { signIn } = await import('./session-helper.js');
  const session=await signIn({address,openUrl});
  const current=await (await fetch(address+'/api/document',{headers:{Authorization:`Bearer ${session.token}`} })).json();
  const document={...current.document,settings:{...current.document.settings,defaultVatRateBp:910}};
  const saved=await fetch(address+'/api/write',{method:'POST',headers:{Authorization:`Bearer ${session.token}`,Origin:address,'Content-Type':'application/json'},body:JSON.stringify({kind:'save',document,expectedDocumentId:current.documentId,expectedRevision:current.revision,opId:'stop-test-write'})});
  assert.equal(saved.status,200);
  const stopped=once(server.child,'exit');
  const { stdout } = await exec(process.execPath,['server/cli.js','stop','--json'],{env:{...process.env,MENUPILOT_DATA_DIR:dir}});
  const result=JSON.parse(stdout);
  assert.equal(result.apiVersion,1); assert.equal(result.command,'stop'); assert.equal(result.data.stopped,true);
  const [code]=await stopped; assert.equal(code,0);
  assert.throws(()=>statSync(join(dir,'lock')),{code:'ENOENT'});
  const { readdirSync } = await import('node:fs');
  const { DatabaseSync } = await import('node:sqlite');
  const db=new DatabaseSync(join(dir,'menupilot.db'),{readOnly:true});
  const backups=readdirSync(join(dir,'backups')).filter(name=>name.endsWith('.sqlite'));
  assert.ok(backups.length>0); assert.equal(db.prepare("SELECT value FROM meta WHERE key='backupDirty'").get().value,'0'); db.close();
});

test('process: simultaneous starters elect one writer and identify its live HTTP instance', {timeout:90000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'menupilot-race-'));
  mkdirSync(join(dir,'lock.guard'));utimesSync(join(dir,'lock.guard'),new Date(0),new Date(0));
  const ports=[await unusedPort(),await unusedPort()];
  const children=ports.map(port=>launch(dir,port));
  t.after(async()=>{for(const p of children)await stop(p);rmSync(dir,{recursive:true});});
  const outcomes=await Promise.all(children.map(p=>ready(p).then(()=>true,()=>false)));
  assert.equal(outcomes.filter(Boolean).length,1);
  const winner=outcomes.indexOf(true), loser=1-winner;
  assert.equal(children[loser].child.exitCode,1);
  assert.ok(children[loser].output().includes(`already running at http://127.0.0.1:${ports[winner]}`));
  assert.ok(children[loser].output().includes(`Lock file: ${join(realpathSync(dir),'lock')}`));
  const owner=JSON.parse(readFileSync(join(dir,'lock'),'utf8'));
  const identity=await (await fetch(`http://127.0.0.1:${ports[winner]}/menupilot-instance`)).json();
  assert.equal(identity.instanceId,owner.instanceId); assert.ok(owner.processStart && owner.bootId);
});
