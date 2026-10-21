import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { createSqliteStorage } from '../../server/sqlite.js';
import { serveLocal } from '../../server/http.js';
import { createHttpStorageAdapter } from '../../src/store/httpAdapter.js';
import { storageAdapterContract } from '../store/adapterContract.js';
import { smallDocument } from '../store/fixtures.js';

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-http-'));
  writeFileSync(join(dir, 'index.html'), '<html><head></head><body><div id="root"></div></body></html>');
  const storage = createSqliteStorage(join(dir, 'data.db'), { initialDocument: smallDocument() });
  const server = await serveLocal({ storage, dataDir: dir, distDir: dir, port: 0 });
  const fetchUI = (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, Origin: server.address } });
  return { ...server, storage, dir, fetchUI, serverClose: server.close,
    open: () => createHttpStorageAdapter({ baseUrl: server.address, token: server.uiToken, fetchImpl: fetchUI }),
    readSaved: () => JSON.stringify(storage.load()),
    failWrites: fail => storage.db.exec(fail
      ? "CREATE TRIGGER fail_write BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'full'); END" : 'DROP TRIGGER fail_write'),
    async close() { await server.close(); storage.close(); rmSync(dir, { recursive: true }); },
  };
}
storageAdapterContract('HttpStorageAdapter', fixture);

test('HTTP: Host, token, content type, routes; HTML returns no-store sign-in page', async t => {
  const f = await fixture(); t.after(() => f.close());
  const unauth = await fetch(`${f.address}/api/document`); assert.equal(unauth.status, 401);
  const wrongHost = await new Promise(resolve => {
    http.get(`${f.address}/api/document`, { headers: { Host: 'evil.example', Authorization: `Bearer ${f.uiToken}` } }, res => { res.resume(); resolve(res.statusCode); });
  });
  assert.equal(wrongHost, 403);
  const html = await fetch(`${f.address}/menupilot/`);
  assert.equal(html.headers.get('cache-control'), 'no-store');
  assert.match(await html.text(), /open-url/);
  assert.equal((await fetch(`${f.address}/api/write`, { method: 'POST', headers: { Authorization: `Bearer ${f.uiToken}`, Origin: f.address }, body: '{}' })).status, 415);
  assert.equal((await fetch(`${f.address}/menupilot/data.db`)).status, 404);
  assert.equal((await fetch(`${f.address}/api/unknown`, { headers: { Authorization: `Bearer ${f.uiToken}`, Origin: f.address } })).status, 404);
});

test('HTTP: lost response after commit retries the same opId exactly once', async t => {
  const f = await fixture(); t.after(() => f.close());
  let dropped = false;
  const adapter = createHttpStorageAdapter({ baseUrl: f.address, token: f.uiToken, retryDelayMs: 1,
    fetchImpl: async (...args) => { const res = await f.fetchUI(...args);
      if (String(args[0]).endsWith('/write') && !dropped) { dropped = true; await res.text(); throw new TypeError('response lost'); }
      return res;
    } });
  const first = await adapter.load(); const doc = structuredClone(first.document); doc.ingredients[0].name = 'Once';
  const saved = await adapter.save(doc, first.revision, 'lost');
  assert.equal(saved.revision, first.revision + 1);
  assert.equal(f.storage.db.prepare('SELECT count(*) AS n FROM journal').get().n, 1);
  assert.equal(f.storage.db.prepare('SELECT count(*) AS n FROM ops').get().n, 1);
});

test('HTTP: beforeReplace rejects without advancing CAS; polling sees another writer', async t => {
  const f = await fixture(); t.after(() => f.close());
  const a = createHttpStorageAdapter({ baseUrl: f.address, token: f.uiToken, fetchImpl: f.fetchUI, pollMs: 10 });
  const first = await a.load(), b = f.open(); await b.load();
  let notify;
  const changed = new Promise(resolve => { notify = resolve; });
  const stop = a.subscribe(notify); t.after(stop);
  const doc = structuredClone(first.document); doc.ingredients[0].name = 'Other';
  await b.save(doc, first.revision, 'other'); await changed;
  await assert.rejects(a.load({ beforeReplace() { throw new Error('draft'); } }), /draft/);
  assert.equal((await a.save(first.document, first.revision, 'stale')).conflict, true);
});

test('HTTP: non-ASCII token is denied and CLI token cannot bypass UI confirmation', async t => {
  const f = await fixture(); t.after(() => f.close());
  assert.equal((await fetch(`${f.address}/api/document`, { headers: { Authorization: 'Bearer ' + 'é'.repeat(64) } })).status, 401);
  assert.equal((await fetch(`${f.address}/api/write`, { method: 'POST', headers: { Authorization: `Bearer ${f.cliToken}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
});


test('HTTP: graceful shutdown bounds unfinished request connections', { timeout: 5000 }, async t => {
  const f = await fixture();
  const socket = connect(Number(new URL(f.address).port), '127.0.0.1');
  await once(socket, 'connect');
  socket.write(`POST /api/write HTTP/1.1\r\nHost: ${new URL(f.address).host}\r\nAuthorization: Bearer ${f.uiToken}\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{`);
  await new Promise(resolve => setTimeout(resolve, 20));
  const closing = f.serverClose();
  let timer;
  try {
    await Promise.race([closing, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('shutdown did not finish')), 2000); })]);
  } finally {
    clearTimeout(timer); socket.destroy(); await closing;
    f.storage.close(); rmSync(f.dir, { recursive: true });
  }
});

test('HTTP: oversized JSON is refused before writing', async t => {
  const { MAX_BODY_BYTES } = await import('../../server/http.js');
  const f = await fixture(); t.after(() => f.close());
  const { request } = await import('node:http');
  // Chunked input exercises the streaming budget independently of Content-Length.
  const status = await new Promise((resolve,reject) => {
    const req=request(f.address+'/api/write',{method:'POST',headers:{Origin:f.address,Authorization:`Bearer ${f.uiToken}`,'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });
    req.on('error',reject);req.end(' '.repeat(MAX_BODY_BYTES+1));
  });
  assert.equal(status,413);
  assert.equal(f.storage.load().revision,0);
});

test('HTTP: dollar replacement patterns in data path remain literal JSON', async t => {
  const f = await fixture(); t.after(() => f.close());
  const path = f.dir + "/we$'ird$$x";
  const { mkdirSync, readFileSync } = await import("node:fs"); mkdirSync(path);
  const other = await serveLocal({ storage: f.storage, dataDir: path, distDir: f.dir, port: 0 });
  t.after(() => other.close());
  const response = await fetch(other.address + '/menupilot/session', { method: 'POST', headers: { Origin: other.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: readFileSync(join(path, 'launch-secret'), 'utf8') }) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const config = await (await fetch(other.address + '/menupilot/local-config.json', { headers: { Cookie: cookie } })).json();
  assert.equal(config.dataDir,path);
});

test('HTTP: invalid history-read bodies return 400 invalid', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const body of [null, {}, [], {id:42}, {id:''}, {id:'x',extra:true}]) {
    const res = await fetch(f.address+'/api/history/read',{method:'POST',headers:{Origin:f.address,Authorization:`Bearer ${f.uiToken}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(res.status,400);assert.equal((await res.json()).code,'invalid');
  }
});

test('HTTP: oversized Content-Length is rejected before receiving body; next request succeeds', async t => {
  const { MAX_BODY_BYTES } = await import('../../server/http.js');
  const f = await fixture(); t.after(() => f.close());
  const agent = new http.Agent({keepAlive:true,maxSockets:1});t.after(()=>agent.destroy());
  const status = await new Promise((resolve,reject)=>{
    const req=http.request(f.address+'/api/write',{method:'POST',agent,headers:{Origin:f.address,Authorization:`Bearer ${f.uiToken}`,'Content-Type':'application/json','Content-Length':MAX_BODY_BYTES+1}},res=>{
      res.resume();res.on('end',()=>resolve([res.statusCode,res.headers.connection]));
    });
    req.on('error',reject);req.setTimeout(1500,()=>req.destroy(new Error('waited for oversized body')));req.flushHeaders();
  });
  assert.deepEqual(status,[413,'close']);
  const next=await new Promise((resolve,reject)=>http.get(f.address+'/api/document',{agent,headers:{Authorization:`Bearer ${f.uiToken}`}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject));
  assert.equal(next,200);
});

test('HTTP: traversal and external symlink never expose files outside dist', async t => {
  const { mkdirSync, symlinkSync } = await import('node:fs');
  const f = await fixture(); t.after(() => f.close());
  const dist=join(f.dir,'static');mkdirSync(dist);
  writeFileSync(join(dist,'index.html'),'<html><head></head><body>app</body></html>');
  writeFileSync(join(f.dir,'secret.json'),'outside-secret');
  symlinkSync(join(f.dir,'secret.json'),join(dist,'linked.json'));
  const other=await serveLocal({storage:f.storage,dataDir:f.dir,distDir:dist,port:0});t.after(()=>other.close());
  for(const path of ['/menupilot/%2e%2e/secret.json','/menupilot/%5c..%5csecret.json','//secret.json','/menupilot/%00secret.json','/menupilot/linked.json']) {
    const res=await new Promise((resolve,reject)=>http.get(other.address,{path},r=>{let text='';r.on('data',b=>text+=b);r.on('end',()=>resolve({status:r.statusCode,text}));}).on('error',reject));
    assert.ok([403,404].includes(res.status),path);assert.ok(!res.text.includes('outside-secret'));
  }
});
