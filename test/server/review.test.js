import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { fork } from 'node:child_process';
import { serveLocal } from '../../server/http.js';
import { createSqliteStorage } from '../../server/sqlite.js';

async function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-review-'));
  writeFileSync(join(dir, 'index.html'), '<head><script>window.ready=true;</script></head><body>private-app</body>');
  writeFileSync(join(dir, 'asset.js'), 'cached-asset');
  const storage = createSqliteStorage(':memory:');
  const f = await serveLocal({ storage, dataDir: dir, distDir: dir, port: 0, openBrowser: async () => true, ...options });
  t.after(async () => { await f.close(); storage.close(); rmSync(dir, { recursive: true }); });
  return { ...f, get openUrl() { return f.openUrl; }, dir };
}
async function login(f, key = f.openUrl.split('#k=')[1]) {
  const res = await fetch(f.address + '/menupilot/session', { method: 'POST', headers: { Origin: f.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
  const body = await res.json();
  return { status: res.status, token: body.token, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const auth = token => ({ Authorization: `Bearer ${token}` });

test('review: a running child serves its snapshot when dist disappears and survives response serialization errors', { timeout: 10000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-static-'));
  writeFileSync(join(dir, 'index.html'), '<head></head>'); writeFileSync(join(dir, 'asset.js'), 'snapshot');
  const child = fork('test/server/fixtures/static-server.js', [dir], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  child.stderr.resume();
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) { const ended = once(child, 'exit'); child.kill(); await ended; } rmSync(dir, { recursive: true }); });
  const [{ address, cliToken }] = await once(child, 'message');
  rmSync(join(dir, 'asset.js'));
  const r = await fetch(address + '/menupilot/asset.js').catch(() => null);
  assert.equal(r?.status, 200); assert.equal(await r.text(), 'snapshot');
  assert.equal((await fetch(address + '/api/document', { headers: auth(cliToken) })).status, 500);
  assert.equal((await fetch(address + '/menupilot-instance')).status, 200);
});
test('review: cookie stolen by a different loopback port cannot obtain a token or write', async t => {
  const f = await fixture(t), a = await login(f), b = await login(f);
  assert.match(a.token ?? '', /^[a-f0-9]{64}$/); assert.notEqual(a.token, b.token);
  const thief = http.createServer(async (req, res) => {
    const headers = { Cookie: req.headers.cookie, Origin: f.address };
    const config = await fetch(f.address + '/menupilot/local-config.json', { headers });
    const write = await fetch(f.address + '/api/write', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
    res.end(JSON.stringify([config.status, write.status]));
  });
  await new Promise(r => thief.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => thief.close(r)));
  const stolen = await fetch(`http://127.0.0.1:${thief.address().port}/menupilot/`, { headers: { Cookie: a.cookie } });
  assert.deepEqual(await stolen.json(), [401, 401]);
  const config = await fetch(f.address + '/menupilot/local-config.json', { headers: auth(a.token) });
  assert.equal(config.status, 200); assert.equal((await config.json()).token, undefined);
});
test('review: launch link expires at 15 minutes; session expires after 1h idle or 10h absolute', async t => {
  let time = 0; const f = await fixture(t, { now: () => time });
  time = 15 * 60_000;
  assert.equal((await login(f)).status, 401);
  async function fresh() {
    const r = await fetch(f.address + '/api/open-url', { method: 'POST', headers: { ...auth(f.cliToken), 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 200); return login(f);
  }
  const a = await fresh(); time += 60 * 60_000;
  assert.equal((await fetch(f.address + '/api/document', { headers: auth(a.token) })).status, 401);
  const b = await fresh(), start = time;
  for (let i = 1; i < 20; i++) {
    time = start + i * 30 * 60_000;
    assert.equal((await fetch(f.address + '/api/document', { headers: auth(b.token) })).status, 200);
  }
  time = start + 10 * 60 * 60_000;
  assert.equal((await fetch(f.address + '/api/document', { headers: auth(b.token) })).status, 401);
});
test('review: open-url rotates links and can revoke sessions; UI cannot issue a link', async t => {
  const f = await fixture(t), a = await login(f);
  const old = f.openUrl.split('#k=')[1];
  const options = { method: 'POST', headers: { ...auth(f.cliToken), 'Content-Type': 'application/json' }, body: '{"revokeSessions":true}' };
  assert.equal((await fetch(f.address + '/api/open-url', options)).status, 200);
  assert.notEqual(f.openUrl.split('#k=')[1], old);
  assert.equal((await login(f, old)).status, 401);
  assert.equal((await fetch(f.address + '/api/document', { headers: auth(a.token) })).status, 401);
  const b = await login(f);
  assert.equal((await fetch(f.address + '/api/open-url', { ...options, headers: { ...auth(b.token), Origin: f.address, 'Content-Type': 'application/json' } })).status, 403);
});
test('review: complete CSP and isolation headers cover redirects, login and bootstrap', async t => {
  const f = await fixture(t);
  const expected = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  for (const path of ['/', '/menupilot/', '/menupilot/login.js', '/menupilot/bootstrap-0.js', '/api/document']) {
    const r = await fetch(f.address + path, { redirect: 'manual' });
    assert.equal(r.headers.get('content-security-policy'), expected);
    for (const [key, value] of Object.entries({ 'cross-origin-resource-policy': 'same-origin', 'cross-origin-opener-policy': 'same-origin', 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' })) assert.equal(r.headers.get(key), value, path + ' ' + key);
    await r.text();
  }
});
test('review: login budget, duplicate cookie and static method are enforced', async t => {
  const f = await fixture(t), a = await login(f);
  assert.equal((await fetch(f.address + '/menupilot/session', { method: 'POST', headers: { Origin: f.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'x'.repeat(1024) }) })).status, 413);
  const html = await (await fetch(f.address + '/menupilot/', { headers: { Cookie: a.cookie + '; ' + a.cookie } })).text();
  assert.ok(!html.includes('private-app'));
  assert.equal((await fetch(f.address + '/menupilot/asset.js', { method: 'POST' })).status, 405);
});
test('review: keep-alive deadline and 100 requests per socket are real socket limits', { timeout: 8000 }, async t => {
  const f = await fixture(t);
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 }); t.after(() => agent.destroy());
  let firstSocket;
  for (let i = 1; i <= 101; i++) {
    const { socket, connection } = await new Promise((resolve, reject) => {
      const req = http.get(f.address + '/menupilot-instance', { agent }, res => { const socket = res.socket; res.resume(); res.on('end', () => resolve({ socket, connection: res.headers.connection })); }); req.on('error', reject);
    });
    if (i === 1) firstSocket = socket;
    if (i === 100) assert.equal(connection, 'close');
    if (i === 101) assert.notEqual(socket, firstSocket);
  }
  const short = await fixture(t, { limits: { keepAliveMs: 100, headersMs: 5000 } });
  const socket = connect(new URL(short.address).port, '127.0.0.1'); await once(socket, 'connect');
  t.after(() => socket.destroy()); socket.resume();
  socket.write(`GET /menupilot-instance HTTP/1.1\r\nHost: ${new URL(short.address).host}\r\n\r\n`);
  const started = Date.now(); await once(socket, 'close');
  assert.ok(Date.now() - started < 2000, 'keep-alive must close before header deadline');
});
test('review: localhost gets safe HTML; diagnostics default to warn and fixed denial reasons', async t => {
  const f = await fixture(t);
  const localhost = await new Promise((resolve, reject) => http.get(f.address + '/menupilot/', { headers: { Host: 'localhost:' + new URL(f.address).port } }, res => { let text = ''; res.on('data', b => text += b); res.on('end', () => resolve({ type: res.headers['content-type'], text, status: res.statusCode })); }).on('error', reject));
  assert.equal(localhost.status, 403); assert.match(localhost.type, /text\/html/); assert.match(localhost.text, /127\.0\.0\.1/);
  for (const [path, options] of [['/api/document', {}], ['/api/document', { headers: { Origin: 'null' } }], ['/menupilot/session', { method: 'POST', headers: { Origin: f.address, 'Content-Type': 'application/json' }, body: '{}' }]]) await fetch(f.address + path, options);
  const rows = readdirSync(join(f.dir, 'logs')).flatMap(n => readFileSync(join(f.dir, 'logs', n), 'utf8').trim().split('\n')).map(JSON.parse);
  assert.ok(rows.every(r => r.status >= 400));
  for (const reason of ['host', 'origin', 'token', 'sign-in']) assert.ok(rows.some(r => r.reason === reason), reason);
});

test('review: error reporting never changes sent headers and contains rejected request handlers', async () => {
  const { handleRequestError, dispatchRequest } = await import('../../server/http.js');
  let headers = 0, destroyed = 0;
  const response = { headersSent: true, writableEnded: false, setHeader() { headers++; throw new Error('sent'); }, destroy() { destroyed++; } };
  handleRequestError({ complete: false }, response, new Error('file gone'));
  assert.equal(headers, 0); assert.equal(destroyed, 1);
  dispatchRequest(async () => { throw new Error('handler setup failed'); }, { complete: false }, response);
  await new Promise(r => setImmediate(r));
  assert.equal(destroyed, 2);
});

test('review: CLI open-url generates a fresh secret each call and revoke flag expires existing tokens', async t => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const f = await fixture(t), a = await login(f);
  const { instanceId } = await (await fetch(f.address + '/menupilot-instance')).json();
  writeFileSync(join(f.dir, 'lock'), JSON.stringify({ address: f.address, instanceId }));
  writeFileSync(join(f.dir, 'token'), f.cliToken, { mode: 0o600 });
  const invoke = async args => (await promisify(execFile)(process.execPath, ['server/cli.js', 'open-url', ...args], { env: { ...process.env, MENUPILOT_DATA_DIR: f.dir } })).stdout.trim();
  const first = await invoke([]), second = await invoke([]);
  assert.equal(first, 'MenuPilot opened in your browser.');
  assert.equal(second, first);
  assert.doesNotMatch(second, /#k=|https?:/);
  await invoke(['--revoke-sessions']);
  assert.equal((await fetch(f.address + '/api/document', { headers: auth(a.token) })).status, 401);
});

test('review: CLI and readable data files disclose no UI capability', async t => {
  let opened;
  const f = await fixture(t, { openBrowser: async url => { opened = url; return true; } });
  const cliHeaders = { ...auth(f.cliToken), Origin: f.address, 'Content-Type': 'application/json' };
  const r = await fetch(f.address + '/api/open-url', { method: 'POST', headers: cliHeaders, body: '{}' });
  assert.deepEqual(await r.json(), { opened: true });
  assert.equal(opened, f.openUrl);
  assert.ok(!readdirSync(f.dir).includes('launch-secret'));
  const key = f.openUrl.split('#k=')[1];
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [readFileSync(join(dir, e.name), 'utf8')]);
  for (const content of walk(f.dir)) assert.ok(!content.includes(key));
  for (const path of ['/api/document', '/api/version', '/api/plans', '/api/local/status', '/menupilot-instance', '/menupilot/', '/menupilot/local-config.json', '/launch-secret', '/api/session', '/api/open-url']) {
    const response = await fetch(f.address + path, { headers: cliHeaders });
    const content = await response.text(); assert.ok(!content.includes(key));
    assert.doesNotMatch(content, /"token"\s*:/);
  }
  for (const key of [f.cliToken, '', 'a'.repeat(64)]) {
    const r = await fetch(f.address + '/menupilot/session', { method: 'POST', headers: cliHeaders, body: JSON.stringify({ key }) });
    assert.equal(r.status, 401);
  }
  const failed = await fixture(t, { openBrowser: async () => false });
  const failure = await fetch(failed.address + '/api/open-url', { method: 'POST', headers: { ...auth(failed.cliToken), 'Content-Type': 'application/json' }, body: '{}' });
  assert.deepEqual(await failure.json(), { opened: false });
});

test('review: startup deletes an obsolete launch-secret and refuses its key', async t => {
  const { createSession } = await import('../../server/session.js');
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-old-launch-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const old = 'a'.repeat(64);
  writeFileSync(join(dir, 'launch-secret'), old, { mode: 0o600 });
  const session = createSession(dir);
  assert.ok(!readdirSync(dir).includes('launch-secret'));
  assert.notEqual(session.key, old);
  assert.equal(session.exchange(old, 'test'), null);
  assert.ok(session.exchange(session.key, 'test'));
});
