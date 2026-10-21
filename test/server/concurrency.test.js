import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, fork } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createServer, request } from 'node:http';

async function freePort() {
  const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const port = s.address().port; await new Promise(r => s.close(r)); return port;
}
async function stop(child, signal = 'SIGTERM') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const done = once(child, 'exit'); child.kill(signal); await done;
}
async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-concurrency-')), port = await freePort();
  const address = `http://127.0.0.1:${port}`, children = [];
  t.after(async () => { for (const c of children) await stop(c); rmSync(dir, { recursive: true }); });
  async function launch() {
    const child = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, MENUPILOT_DATA_DIR: dir, MENUPILOT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    let diagnostics = ''; child.stderr.on('data', b => { diagnostics += b; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Startup timeout')), 30000);
      child.stdout.on('data', b => { if (String(b).includes('MenuPilot: http')) { clearTimeout(timer); resolve(); } });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Server failed: ' + diagnostics)); });
      child.stderr.resume();
    });
    return child;
  }
  async function login() {
    const key = readFileSync(join(dir, 'launch-secret'), 'utf8');
    const response = await fetch(address + '/menupilot/session', { method: 'POST', headers: { Origin: address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const config = await response.json();
    return { cookie, ui: config.token, cli: readFileSync(join(dir, 'token'), 'utf8') };
  }
  function client() {
    const child = fork('test/server/fixtures/client.js', { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] }); children.push(child);
    let next = 0;
    return (url, options) => new Promise((resolve, reject) => {
      const id = ++next, timer = setTimeout(() => { child.off('message', handle); reject(new Error('Client timeout')); }, 10000);
      const handle = message => { if (message.id === id) { clearTimeout(timer); child.off('message', handle); resolve(message); } };
      child.on('message', handle); child.send({ id, url, options });
    });
  }
  return { address, dir, launch, login, client };
}
const save = (record, i) => ({ kind: 'save', expectedDocumentId: record.documentId, expectedRevision: record.revision, opId: `series-${i}`,
  document: { ...record.document, ingredients: [{ id: 'flour', name: `Flour ${i}`, unit: 'g', prices: [] }] } });
const options = (f, token, body) => ({ method: 'POST', headers: { Origin: f.address, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('processes: UI writes concurrent with CLI reads, then SIGKILL/restart mid-series and durable replay', { timeout: 90000 }, async t => {
  const f = await fixture(t); let server = await f.launch(), auth = await f.login();
  const ui = f.client(), cli = f.client();
  let record = (await cli(f.address + '/api/document', { headers: { Authorization: `Bearer ${auth.cli}` } })).body;
  let priorRevision = 0;
  for (let i = 0; i < 10; i++) {
    const input = save(record, i);
    const [written, read] = await Promise.all([
      ui(f.address + '/api/write', options(f, auth.ui, input)),
      cli(f.address + '/api/document', { headers: { Authorization: `Bearer ${auth.cli}` } }),
    ]);
    assert.equal(written.status, 200); assert.equal(read.status, 200);
    assert.ok([record.revision, record.revision + 1].includes(read.body.revision));
    assert.ok(read.body.revision >= priorRevision); priorRevision = read.body.revision;
    if (read.body.revision) assert.equal(read.body.document.ingredients[0].name, `Flour ${read.body.revision - 1}`);
    record = written.body;
    if (i === 4) {
      await stop(server, 'SIGKILL'); server = await f.launch(); auth = await f.login();
      const retry = await ui(f.address + '/api/write', options(f, auth.ui, input));
      assert.deepEqual(retry.body.receipt, record.receipt); assert.equal(retry.body.revision, 5);
    }
  }
  assert.equal(record.revision, 10);
  const history = (await cli(f.address + '/api/history', { headers: { Authorization: `Bearer ${auth.cli}` } })).body;
  assert.equal(history.length, 10);
});

test('processes: response socket is lost after commit; retry after restart returns original receipt once', { timeout: 90000 }, async t => {
  const f = await fixture(t); let server = await f.launch(), auth = await f.login();
  const ui = f.client();
  const record = (await ui(f.address + '/api/document', { headers: { Authorization: `Bearer ${auth.ui}` } })).body;
  const input = save(record, 0);
  let committed;
  const proxy = createServer((req, res) => {
    const upstream = request(f.address + '/api/write', { method: 'POST', headers: { ...req.headers, host: new URL(f.address).host } }, response => {
      let raw = ''; response.on('data', b => { raw += b; });
      response.on('end', () => { committed = JSON.parse(raw); res.destroy(); });
    });
    upstream.on('error', () => res.destroy()); req.pipe(upstream);
  });
  await new Promise(r => proxy.listen(0, '127.0.0.1', r)); t.after(() => new Promise(r => proxy.close(r)));
  const lost = await ui(`http://127.0.0.1:${proxy.address().port}/api/write`, options(f, auth.ui, input));
  assert.equal(lost.transportError, true); assert.equal(committed.revision, 1);
  await stop(server, 'SIGKILL'); server = await f.launch(); auth = await f.login();
  const retry = await ui(f.address + '/api/write', options(f, auth.ui, input));
  assert.deepEqual(retry.body.receipt, committed.receipt); assert.equal(retry.body.revision, 1);
  assert.equal((await ui(f.address + '/api/history', { headers: { Authorization: `Bearer ${auth.ui}` } })).body.length, 1);
});

test('processes: two clients with the same browser cookie still enforce CAS; open-url uses private current secret', { timeout: 90000 }, async t => {
  const f = await fixture(t); await f.launch(); const auth = await f.login();
  const a = f.client(), b = f.client();
  const configs = await Promise.all([a, b].map(client => client(f.address + '/menupilot/local-config.json', { headers: { Cookie: auth.cookie, Authorization: `Bearer ${auth.ui}` } })));
  assert.equal(configs[0].status, 200); assert.deepEqual(configs[0].body, configs[1].body);
  const record = (await a(f.address + '/api/document', { headers: { Authorization: `Bearer ${auth.ui}` } })).body;
  const results = await Promise.all([a, b].map((client, i) => client(f.address + '/api/write', options(f, auth.ui, save(record, i)))));
  assert.equal(results.filter(r => r.body.conflict).length, 1);
  assert.equal(results.filter(r => r.body.receipt?.changed).length, 1);
  const cli = spawn(process.execPath, ['server/cli.js', 'open-url'], { env: { ...process.env, MENUPILOT_DATA_DIR: f.dir } });
  let url = ''; cli.stdout.on('data', b => { url += b; }); cli.stderr.resume();
  assert.equal((await once(cli, 'exit'))[0], 0);
  assert.equal(url.trim(), f.address + '/menupilot/#k=' + readFileSync(join(f.dir, 'launch-secret'), 'utf8'));
});
