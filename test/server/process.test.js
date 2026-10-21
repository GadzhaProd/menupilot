import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
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
  for(const v of ['20.19.0','22.13.0','24.14.0','25.0.0'])assert.throws(()=>assertRuntime(v),/24.15.0/);
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
  await stop(first);assert.throws(()=>statSync(join(dir,'lock')),{code:'ENOENT'});
  const third=launch(dir,port);children.push(third);await ready(third);
  const ended=once(third.child,'exit');third.child.kill('SIGKILL');await ended;
  const fourth=launch(dir,port);children.push(fourth);await ready(fourth);await stop(fourth);
});
