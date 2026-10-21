import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { openLocalStorage } from '../../server/backups.js';

async function stop(child, signal = 'SIGTERM') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exit = once(child, 'exit'); child.kill(signal); await exit;
}
function cli(dir, args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['server/cli.js', ...args], { env: { ...process.env, MENUPILOT_DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
    child.once('exit', code => resolve({ code, output }));
  });
}

test('process: SIGKILL during SQLite backup publishes no partial file; restart captures dirty revision', { timeout: 15000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-kill-backup-'));
  const child = fork('test/server/fixtures/interrupted-backup.js', [dir], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  t.after(async () => { await stop(child, 'SIGKILL'); rmSync(dir, { recursive: true }); });
  const [message] = await once(child, 'message'); assert.equal(message.copying, true);
  assert.ok(readdirSync(join(dir, 'backups')).some(f => f.endsWith('.partial')));
  await stop(child, 'SIGKILL');
  assert.equal(readdirSync(join(dir, 'backups')).filter(f => f.endsWith('.sqlite')).length, 0);
  const recovered = await openLocalStorage(dir, { timers: false });
  try {
    assert.equal(recovered.backups.list().length, 1);
    const entry = recovered.backups.list()[0];
    assert.equal(entry.reason, 'startup'); assert.equal(entry.revision, 1);
    await recovered.backups.verify(entry.id);
    assert.equal(readdirSync(join(dir, 'backups')).filter(f => f.includes('.partial')).length, 0);
  } finally { await recovered.close(); }
});

test('process: authenticated backup CLI, confirmation, new revision, offline refusal and recovery lock', { timeout: 90000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-backup-cli-'));
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const address = `http://127.0.0.1:${port}`;
  let child;
  t.after(async () => { if (child) await stop(child); rmSync(dir, { recursive: true }); });
  const offline = await cli(dir, ['backup', 'list']);
  assert.equal(offline.code, 1); assert.match(offline.output, /Run npm start/);
  const seed = await openLocalStorage(dir, { timers: false }); await seed.close();
  const db = new DatabaseSync(join(dir, 'menupilot.db'));
  db.prepare("INSERT INTO meta(key,value) VALUES('backupClockWarning','1')").run(); db.close();
  writeFileSync(join(dir, 'backups', `${Date.now()}-${crypto.randomUUID()}.sqlite`), 'corrupt snapshot');
  child = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, MENUPILOT_DATA_DIR: dir, MENUPILOT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error(output)), 30000);
    child.stderr.on('data', b => { output += b; });
    child.stdout.on('data', b => { output += b; if (output.includes('MenuPilot: http')) { clearTimeout(timer); resolve(); } });
    child.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
  });
  const auth = await (await fetch(address + '/menupilot/session', { method: 'POST', headers: { Origin: address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: readFileSync(join(dir, 'launch-secret'), 'utf8') }) })).json();
  const uiHeaders = { Authorization: `Bearer ${auth.token}`, Origin: address, 'Content-Type': 'application/json' };
  const headers = { Authorization: `Bearer ${readFileSync(join(dir, 'token'), 'utf8')}` };
  for (const route of ['backups', 'backups/status']) assert.equal((await fetch(address + '/api/' + route)).status, 401);
  const health = await cli(dir, ['doctor']);
  assert.equal(health.code, 0); assert.match(health.output, /"clockWarning": true/);
  assert.match(health.output, /"corruptBackups": 1/);
  assert.match(health.output, /automatic backup deletion is paused/);
  assert.match(health.output, /isolated in quarantine/);
  const initial = await (await fetch(address + '/api/document', { headers })).json();
  const saved = await (await fetch(address + '/api/write', { method: 'POST', headers: uiHeaders, body: JSON.stringify({ kind: 'save', document: initial.document, expectedDocumentId: null, expectedRevision: 0, opId: 'saved' }) })).json();
  const document = structuredClone(saved.document); document.settings.defaultVatRateBp = 2100;
  const importedResponse = await fetch(address + '/api/write', { method: 'POST', headers: uiHeaders, body: JSON.stringify({ kind: 'import', source: { ...initial, document }, expectedDocumentId: saved.documentId, expectedRevision: saved.revision, opId: 'imported' }) });
  assert.equal(importedResponse.status, 200);
  const imported = await importedResponse.json();
  const entries = (await (await fetch(address + '/api/backups', { headers })).json()).filter(e => !e.invalid);
  assert.equal(entries.length, 1); assert.equal(entries[0].revision, saved.revision);
  const id = entries[0].id;
  assert.match((await cli(dir, ['backup', 'list'])).output, new RegExp(id));
  const verified = await cli(dir, ['backup', 'verify', id]); assert.equal(verified.code, 0); assert.match(verified.output, /temporary database/);
  const denied = await cli(dir, ['backup', 'restore', id]); assert.equal(denied.code, 1); assert.match(denied.output, /Confirmation required/);
  const recovered = await cli(dir, ['backup', 'restore', id, '--yes']); assert.equal(recovered.code, 0, recovered.output);
  const current = await (await fetch(address + '/api/document', { headers })).json();
  assert.equal(current.revision, imported.revision + 1); assert.deepEqual(current.document, saved.document);
  const emergency = await cli(dir, ['doctor', '--recover-from-backup', id, '--yes']);
  assert.equal(emergency.code, 1); assert.match(emergency.output, /already running/);
  await stop(child);
  assert.match((await cli(dir, ['backup', 'verify', id])).output, /Run npm start/);
});
