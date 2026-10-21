import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { once } from 'node:events';
import { serveLocal, MAX_BODY_BYTES } from '../../server/http.js';
import { createSqliteStorage } from '../../server/sqlite.js';

async function fixture(t, limits) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-security-'));
  writeFileSync(join(dir, 'index.html'), '<html><head><script>window.appearanceReady = true;</script></head><body>private-app</body></html>');
  const storage = createSqliteStorage(':memory:');
  const f = await serveLocal({ storage, dataDir: dir, distDir: dir, port: 0, limits });
  t.after(async () => { await f.close(); storage.close(); rmSync(dir, { recursive: true }); });
  return { ...f, dir, storage };
}
async function login(f) {
  const key = readFileSync(join(f.dir, 'launch-secret'), 'utf8');
  const r = await fetch(f.address + '/menupilot/session', { method: 'POST', headers: { Origin: f.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
  assert.equal(r.status, 200);
  return { key, cookie: r.headers.get('set-cookie').split(';')[0], header: r.headers.get('set-cookie') };
}
test('security: page and config require cookie; one-time key, hardened headers and clean URL', async t => {
  const f = await fixture(t);
  const r = await fetch(f.address + '/menupilot/');
  const html = await r.text();
  assert.ok(!html.includes('private-app'));
  assert.match(html, /open-url/); assert.match(html, /terminal/i); assert.match(html, /lang="nl"/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.ok(!r.headers.get('content-security-policy').includes("script-src 'self' 'unsafe-inline'"));
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(f.address + '/menupilot/local-config.json')).status, 401);
  const session = await login(f);
  assert.match(session.header, /HttpOnly/); assert.match(session.header, /SameSite=Strict/); assert.match(session.header, /Path=\/menupilot\//);
  assert.equal(statSync(join(f.dir, 'launch-secret')).mode & 0o777, 0o600);
  const headers = { Cookie: session.cookie };
  const page = await (await fetch(f.address + '/menupilot/', { headers })).text();
  assert.match(page, /private-app/); assert.ok(!page.includes(f.uiToken));
  assert.ok(!page.includes('<script>'));
  assert.match(page, /src="\/menupilot\/bootstrap-0.js"/);
  assert.match(await (await fetch(f.address + '/menupilot/bootstrap-0.js')).text(), /window.appearanceReady = true/);
  assert.equal((await (await fetch(f.address + '/menupilot/local-config.json', { headers })).json()).token, f.uiToken);
  const replay = await fetch(f.address + '/menupilot/session', { method: 'POST', headers: { Origin: f.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: session.key }) });
  assert.equal(replay.status, 401);
  assert.notEqual(readFileSync(join(f.dir, 'launch-secret'), 'utf8'), session.key);
  const script = await (await fetch(f.address + '/menupilot/login.js')).text();
  assert.ok(script.indexOf('history.replaceState') < script.indexOf('fetch('));
  assert.match(script, /addEventListener\('hashchange'/);
});
test('security: foreign/null Origin denied on reads and writes; missing Origin only CLI POST', async t => {
  const f = await fixture(t);
  for (const token of [f.uiToken, f.cliToken]) {
    for (const origin of ['null', 'https://evil.example', f.address + '.evil.example']) {
      for (const [path, method] of [['document', 'GET'], ['write', 'POST']]) {
        const r = await fetch(f.address + '/api/' + path, { method, headers: { Authorization: `Bearer ${token}`, Origin: origin, 'Content-Type': 'application/json' }, ...(method === 'POST' && { body: '{}' }) });
        assert.equal(r.status, 403);
      }
    }
  }
  const headers = { Authorization: `Bearer ${f.uiToken}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(f.address + '/api/write', { method: 'POST', headers, body: '{}' })).status, 403);
  assert.equal((await fetch(f.address + '/api/document', { headers })).status, 200);
  assert.equal((await fetch(f.address + '/api/history/read', { method: 'POST', headers: { ...headers, Authorization: `Bearer ${f.cliToken}` }, body: '{"id":"absent"}' })).status, 400);
  assert.equal((await fetch(f.address + '/api/write', { headers: { ...headers, Origin: f.address } })).status, 404);
  assert.equal((await fetch(f.address + '/api/write', { method: 'POST', headers: { ...headers, Origin: f.address, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  for (const origin of [undefined, 'null', 'https://evil.example']) {
    const r = await fetch(f.address + '/menupilot/session', { method: 'POST', headers: { ...(origin && { Origin: origin }), 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 403);
  }
});
test('security: slow headers/body, connection cap, UTF-8 budget', { timeout: 8000 }, async t => {
  const f = await fixture(t, { headersMs: 500, bodyMs: 150, keepAliveMs: 100, connections: 2 });
  assert.ok(MAX_BODY_BYTES >= Buffer.byteLength('漢'.repeat(5_000_000)));
  async function slow(request) {
    const s = connect(new URL(f.address).port, '127.0.0.1'); s.on('error', () => {}); await once(s, 'connect');
    let result = ''; s.on('data', b => { result += b; });
    const ended = once(s, 'close'); s.write(request); await ended; return result;
  }
  assert.match(await slow('GET /menupilot/ HTTP/1.1\r\n'), /408/);
  assert.match(await slow(`POST /api/write HTTP/1.1\r\nHost: ${new URL(f.address).host}\r\nOrigin: ${f.address}\r\nAuthorization: Bearer ${f.uiToken}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`), /408/);
  const sockets = [connect(new URL(f.address).port, '127.0.0.1'), connect(new URL(f.address).port, '127.0.0.1')];
  for (const s of sockets) { s.on('error', () => {}); s.resume(); }
  await Promise.all(sockets.map(s => once(s, 'connect')));
  const extra = connect(new URL(f.address).port, '127.0.0.1'); extra.on('error', () => {}); extra.resume();
  await Promise.race([once(extra, 'close'), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('connection cap not enforced')), 100); timer.unref(); })]); sockets.forEach(s => s.destroy());
});

test('security: diagnostics rotate, respect level and never record user-controlled secrets', async t => {
  const { createLogger } = await import('../../server/log.js');
  const f = await fixture(t), session = await login(f);
  const secret = 'DOCUMENT-PRIVATE-CONTENT';
  await fetch(f.address + '/api/' + secret + '?token=' + f.uiToken, { headers: { Authorization: `Bearer ${f.cliToken}`, Cookie: session.cookie } });
  await fetch(f.address + '/api/write', { method: 'POST', headers: { Origin: f.address, Authorization: `Bearer ${f.uiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: secret }) });
  const readLogs = () => readdirSync(join(f.dir, 'logs')).map(name => readFileSync(join(f.dir, 'logs', name), 'utf8')).join('');
  const output = readLogs();
  for (const value of [secret, session.key, session.cookie.split('=')[1], f.cliToken, f.uiToken]) assert.ok(!output.includes(value));
  assert.match(output, /"status":400/);
  const logger = createLogger(f.dir, { maxBytes: 300, files: 3, level: 'warn' });
  for (let i = 0; i < 50; i++) logger('request', 403);
  const files = readdirSync(join(f.dir, 'logs')); assert.equal(files.length, 3);
  for (const file of files) { assert.ok(statSync(join(f.dir, 'logs', file)).size <= 300); assert.equal(statSync(join(f.dir, 'logs', file)).mode & 0o777, 0o600); }
  const before = readLogs(); logger('request', 200); logger(secret, 400); logger('request', secret);
  assert.equal(readLogs(), before);
  const off = createLogger(f.dir, { level: 'off' }); off('request', 500); assert.equal(readLogs(), before);
  assert.throws(() => createLogger(f.dir, { level: 'typo' }), /MENUPILOT_LOG_LEVEL/);
});

test('security: entering a sign-in fragment on an already open page clears it before exchange', async () => {
  const { runInNewContext } = await import('node:vm');
  const events = {}, calls = [];
  const location = { hash: '', replace: url => calls.push(['redirect', url]) };
  runInNewContext(readFileSync(new URL('../../server/login.js', import.meta.url), 'utf8'), {
    URLSearchParams, location,
    history: { replaceState: (_state, _title, url) => { calls.push(['clear', url]); location.hash = ''; } },
    addEventListener: (name, callback) => { events[name] = callback; },
    fetch: async (_url, options) => { calls.push(['exchange', location.hash, JSON.parse(options.body).key]); return { ok: true }; },
  });
  assert.deepEqual(calls, []);
  location.hash = '#k=private'; events.hashchange();
  await new Promise(r => setImmediate(r));
  assert.deepEqual(calls, [['clear', '/menupilot/'], ['exchange', '', 'private'], ['redirect', '/menupilot/']]);
});

test('security: rebinding Host and invalid cookies never disclose HTML or config', async t => {
  const { get } = await import('node:http');
  const f = await fixture(t);
  for (const host of ['evil.example', `127.0.0.1.nip.io:${new URL(f.address).port}`, `localhost:${new URL(f.address).port}`]) {
    for (const path of ['/menupilot/', '/menupilot/local-config.json', '/api/document']) {
      const status = await new Promise((resolve, reject) => get(f.address + path, { headers: { Host: host, Authorization: `Bearer ${f.uiToken}` } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject));
      assert.equal(status, 403);
    }
  }
  for (const cookie of ['menupilot_session=forged', `menupilot_session_${new URL(f.address).port}=${'a'.repeat(64)}`]) {
    const response = await fetch(f.address + '/menupilot/local-config.json', { headers: { Cookie: cookie } });
    assert.equal(response.status, 401);
  }
});
