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
  return { ...server, storage, dir, serverClose: server.close,
    open: () => createHttpStorageAdapter({ baseUrl: server.address, token: server.uiToken }),
    readSaved: () => JSON.stringify(storage.load()),
    failWrites: fail => storage.db.exec(fail
      ? "CREATE TRIGGER fail_write BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'full'); END" : 'DROP TRIGGER fail_write'),
    async close() { await server.close(); storage.close(); rmSync(dir, { recursive: true }); },
  };
}
storageAdapterContract('HttpStorageAdapter', fixture);

test('HTTP: Host, token, content type, routes; HTML safely embeds no-store config', async t => {
  const f = await fixture(); t.after(() => f.close());
  const unauth = await fetch(`${f.address}/api/document`); assert.equal(unauth.status, 401);
  const wrongHost = await new Promise(resolve => {
    http.get(`${f.address}/api/document`, { headers: { Host: 'evil.example', Authorization: `Bearer ${f.uiToken}` } }, res => { res.resume(); resolve(res.statusCode); });
  });
  assert.equal(wrongHost, 403);
  const html = await fetch(`${f.address}/menupilot/`);
  assert.equal(html.headers.get('cache-control'), 'no-store');
  assert.match(await html.text(), /menupilot-local-config/);
  assert.equal((await fetch(`${f.address}/api/write`, { method: 'POST', headers: { Authorization: `Bearer ${f.uiToken}` }, body: '{}' })).status, 415);
  assert.equal((await fetch(`${f.address}/menupilot/data.db`)).status, 404);
  assert.equal((await fetch(`${f.address}/api/unknown`, { headers: { Authorization: `Bearer ${f.uiToken}` } })).status, 404);
});

test('HTTP: lost response after commit retries the same opId exactly once', async t => {
  const f = await fixture(); t.after(() => f.close());
  let dropped = false;
  const adapter = createHttpStorageAdapter({ baseUrl: f.address, token: f.uiToken, retryDelayMs: 1,
    fetchImpl: async (...args) => { const res = await fetch(...args);
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
  const a = createHttpStorageAdapter({ baseUrl: f.address, token: f.uiToken, pollMs: 10 });
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

test('HTTP: oversized JSON is refused before writing; config escapes script delimiters', async t => {
  const { MAX_BODY_BYTES, escapeConfig } = await import('../../server/http.js');
  assert.equal(escapeConfig({ path: '</script>\u2028&' }).includes('<'),false);
  assert.deepEqual(JSON.parse(escapeConfig({ path: '</script>\u2028&' })),{ path: '</script>\u2028&' });
  const f = await fixture(); t.after(() => f.close());
  const response = await fetch(`${f.address}/api/write`, { method:'POST', headers:{Authorization:`Bearer ${f.uiToken}`,'Content-Type':'application/json'},body:' '.repeat(MAX_BODY_BYTES+1) });
  assert.equal(response.status,413);
  assert.equal(f.storage.load().revision,0);
});
