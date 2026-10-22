import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteStorage } from '../../server/sqlite.js';
import * as backups from '../../server/backups.js';

const request = (r, kind = 'save', extra = {}) => ({ kind, expectedDocumentId: r.documentId, expectedRevision: r.revision, opId: crypto.randomUUID(), document: r.document, ...extra });
async function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-backups-'));
  const raw = createSqliteStorage(join(dir, 'menupilot.db'), { now: options.now });
  const service = await backups.manageBackups(raw, dir, { timers: false, ...options });
  t.after(async () => { await service.close(); rmSync(dir, { recursive: true }); });
  return { raw, service, dir };
}

test('backups: dirty state is durable; verified atomic snapshot identifies the exact revision', async t => {
  assert.equal(typeof backups.manageBackups, 'function');
  const { raw, service, dir } = await fixture(t);
  await service.write(request(service.load()));
  assert.equal(raw.db.prepare("SELECT value FROM meta WHERE key='backupDirty'").get().value, '1');
  await service.backups.capture('automatic');
  const list = service.backups.list(); assert.equal(list.length, 1);
  assert.equal(list[0].revision, service.load().revision);
  assert.equal(list[0].documentId, service.load().documentId);
  const checked = await service.backups.verify(list[0].id);
  assert.deepEqual(checked.record, service.load());
  assert.equal(service.backups.status().dirty, false);
  assert.equal(readdirSync(join(dir, 'backups')).filter(f => f.endsWith('.partial')).length, 0);
});

test('backups: import serializes its pre-copy with replacement and restore creates a new revision and receipt', async t => {
  const { raw, service } = await fixture(t);
  await service.write(request(service.load())); const before = service.load();
  const document = structuredClone(before.document); document.settings.defaultVatRateBp = 2100;
  const replacing = service.write(request(before, 'import', { document: undefined, source: { ...before, document } }));
  const racing = service.write(request(before));
  const imported = await replacing;
  assert.equal((await racing).conflict, true);
  const list = service.backups.list(); assert.equal(list.length, 1);
  assert.deepEqual((await service.backups.verify(list[0].id)).record, before);
  const command = { id: list[0].id, expectedDocumentId: imported.documentId, expectedRevision: imported.revision, opId: 'restore-once' };
  const restored = await service.backups.restore(command, 'cli');
  assert.deepEqual(restored.document, before.document);
  assert.equal(restored.revision, imported.revision + 1);
  assert.equal(restored.documentId, imported.documentId);
  assert.equal(JSON.parse(raw.db.prepare('SELECT entry FROM journal ORDER BY seq DESC LIMIT 1').get().entry).kind, 'backup-restore');
  assert.deepEqual((await service.backups.restore(command, 'cli')).receipt, restored.receipt);
  assert.equal(service.load().revision, restored.revision);
  for (const entry of service.backups.list()) await service.backups.verify(entry.id);
});

test('backups: startup after abrupt close snapshots durable dirty data; shutdown also captures', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-restart-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const raw = createSqliteStorage(join(dir, 'menupilot.db'));
  raw.write(request(raw.load())); const saved = raw.load(); raw.close();
  const service = await backups.openLocalStorage(dir, { timers: false });
  assert.deepEqual((await service.backups.verify(service.backups.list()[0].id)).record, saved);
  assert.equal(service.backups.list()[0].reason, 'startup');
  const document = structuredClone(saved.document); document.settings.defaultVatRateBp++;
  await service.write(request(saved, 'save', { document }));
  await service.close();
  const reopened = await backups.openLocalStorage(dir, { timers: false });
  assert.equal(reopened.backups.list()[0].reason, 'shutdown');
  await reopened.close();
});

test('backups: graceful close waits for a queued write before its shutdown snapshot', async t => {
  const { raw, service } = await fixture(t);
  const write = raw.write.bind(raw);
  let release;
  raw.write = async (...args) => { await new Promise(resolve => { release = resolve; }); return write(...args); };
  const pending = service.write(request(service.load()));
  await new Promise(resolve => setImmediate(resolve));
  let closed = false;
  const closing = service.close().then(() => { closed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, false);
  release(); await pending; await closing;
  assert.equal(service.backups.list()[0].reason, 'shutdown');
});

test('backups: an older program refuses a newer database without changing it', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-future-db-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'menupilot.db');
  const storage = createSqliteStorage(path); storage.write(request(storage.load())); storage.db.exec('PRAGMA user_version=3'); storage.close();
  await assert.rejects(backups.openLocalStorage(dir, { timers: false }), error => error.code === 'unsupported-version' && /newer MenuPilot/i.test(error.message));
  const reopened = new DatabaseSync(path, { readOnly: true });
  assert.equal(reopened.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(JSON.parse(reopened.prepare('SELECT record FROM document').get().record).revision, 1);
  reopened.close();
});

test('backups: ENOSPC copying blocks import, keeps dirty and previous data, then retries', async t => {
  const { backup } = await import('node:sqlite');
  let full = true;
  const { raw, service } = await fixture(t, { backupImpl: (...args) => {
    if (full) throw Object.assign(new Error('full'), { code: 'ENOSPC' });
    return backup(...args);
  } });
  await service.write(request(service.load())); const before = service.load();
  await assert.rejects(service.write(request(before, 'import', { document: undefined, source: before })), /disk space/);
  assert.deepEqual(service.load(), before);
  assert.equal(service.backups.list().length, 0);
  assert.equal(service.backups.status().dirty, true);
  assert.ok(service.backups.status().backupError);
  assert.equal(raw.db.prepare('SELECT count(*) AS n FROM ops').get().n, 1);
  full = false;
  await service.backups.capture('retry');
  assert.equal(service.backups.status().backupError, null);
});

test('backups: unavailable external folder retries with backoff and exposes warning', async t => {
  const { mkdirSync } = await import('node:fs');
  const root = mkdtempSync(join(tmpdir(), 'menupilot-external-'));
  t.after(() => rmSync(root, { recursive: true }));
  const externalDir = join(root, 'missing'); let time = 10000;
  const { service } = await fixture(t, { externalDir, monotonic: () => time });
  await service.write(request(service.load()));
  await service.backups.capture('test');
  assert.equal(service.backups.status().externalError, 'external-unavailable');
  assert.equal(service.backups.status().externalOverdue, true);
  mkdirSync(externalDir);
  await service.backups.tick();
  assert.equal(service.backups.status().lastExternalBackupAt, null);
  time += 10000; await service.backups.tick();
  assert.equal(service.backups.status().externalError, null);
  assert.ok(service.backups.status().lastExternalBackupAt);
  await service.backups.tick();
  assert.equal(service.backups.status().externalError, null);
});

test('backups: backward wall clock cannot defer RPO timer or hide overdue copying', async t => {
  const { backup } = await import('node:sqlite');
  let wall = Date.now(), mono = 0, full = false;
  const { service } = await fixture(t, { now: () => wall, monotonic: () => mono, backupImpl: (...args) => {
    if (full) throw new Error('full'); return backup(...args);
  } });
  await service.write(request(service.load()));
  full = true; wall -= 3600000; mono += backups.RPO_MS + 1;
  await service.backups.tick();
  assert.equal(service.backups.status().overdue, true);
  assert.equal(service.backups.status().clockWarning, true);
  full = false; await service.backups.tick();
  assert.equal(service.backups.status().dirty, false);
});

test('backups: migration requires and publishes a verified v1 pre-copy before v2', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-migrate-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const raw = createSqliteStorage(join(dir, 'menupilot.db'));
  raw.write(request(raw.load())); const before = raw.load();
  raw.db.exec('PRAGMA user_version=1'); raw.close();
  await assert.rejects(backups.openLocalStorage(dir, { timers: false, backupImpl: () => { throw new Error('full'); } }), /backup/);
  const { DatabaseSync } = await import('node:sqlite');
  const failed = new DatabaseSync(join(dir, 'menupilot.db'));
  assert.equal(failed.prepare('PRAGMA user_version').get().user_version, 1); failed.close();
  const service = await backups.openLocalStorage(dir, { timers: false });
  t.after(() => service.close());
  const migration = service.backups.list().find(e => e.reason === 'before-migration');
  assert.equal(migration.dbVersion, 1);
  assert.deepEqual((await service.backups.verify(migration.id)).record, before);
});

test('backups: real SQLite FULL rolls back document, history, dirty flag and receipt', async t => {
  const { raw, service } = await fixture(t);
  await service.write(request(service.load())); await service.backups.capture('test');
  const before = service.load();
  const pages = raw.db.prepare('PRAGMA page_count').get().page_count;
  raw.db.exec(`PRAGMA max_page_count=${pages}`);
  const document = structuredClone(before.document);
  document.ingredients = Array.from({ length: 800 }, (_, i) => ({ id: 'ingredient-' + i, name: 'Ingredient '.repeat(15) + i, unit: 'g', prices: [] }));
  await assert.rejects(service.write(request(before, 'save', { document })), /disk space/);
  assert.deepEqual(service.load(), before);
  assert.equal(service.backups.status().dirty, false);
  assert.equal(raw.db.prepare('SELECT count(*) AS n FROM ops').get().n, 1);
  raw.db.exec('PRAGMA max_page_count=1073741823');
});

test('backups: budget rejects a new copy without losing the last good copy or current data', async t => {
  const budget = { count: 1, bytes: 1024 ** 3 };
  const { service } = await fixture(t, { budget });
  await service.write(request(service.load())); await service.backups.capture('test');
  const first = service.backups.list()[0], before = service.load();
  await assert.rejects(service.write(request(before, 'reset', { resetKind: 'empty' })), /budget/);
  assert.deepEqual(service.load(), before);
  assert.deepEqual((await service.backups.verify(first.id)).record, before);
});

test('backups: doctor preserves corrupt originals, records report and makes a verified fresh identity', async t => {
  const { writeFileSync, readFileSync, statSync } = await import('node:fs');
  const { recoverFromBackup } = await import('../../server/recovery.js');
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-doctor-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const s = await backups.openLocalStorage(dir, { timers: false });
  await s.write(request(s.load())); const before = s.load();
  await s.backups.capture('test'); const id = s.backups.list()[0].id; await s.close();
  const damaged = Buffer.from('not a database: preserve me');
  writeFileSync(join(dir, 'menupilot.db'), damaged);
  await assert.rejects(backups.openLocalStorage(dir, { timers: false }), /doctor/);
  const report = await recoverFromBackup(dir, id);
  assert.deepEqual(readFileSync(join(dir, report.archive, 'menupilot.db')), damaged);
  assert.equal(JSON.parse(readFileSync(report.reportPath)).status, 'recovered');
  assert.equal(statSync(join(dir, 'menupilot.db')).mode & 0o777, 0o600);
  const recovered = await backups.openLocalStorage(dir, { timers: false });
  assert.deepEqual(recovered.load().document, before.document);
  assert.notEqual(recovered.load().documentId, before.documentId);
  assert.equal(recovered.load().revision, before.revision + 1);
  await recovered.close();
});

test('backups: verify refuses semantically corrupt snapshots even when SQLite integrity is ok', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const { service, dir } = await fixture(t);
  await service.write(request(service.load())); await service.backups.capture('test');
  const id = service.backups.list()[0].id;
  const bad = new DatabaseSync(join(dir, 'backups', id + '.sqlite'));
  const record = service.load(); record.document.ingredients = [{ broken: true }];
  bad.prepare('UPDATE document SET record=?').run(JSON.stringify(record)); bad.close();
  await assert.rejects(service.backups.verify(id), /could not be restored/);
});

test('backups: retention keeps every last-day snapshot and 14 daily restore points', async t => {
  const { pruneSnapshots } = await import('../../server/backupFiles.js');
  let wall = Date.UTC(2026, 0, 1);
  const { service, dir } = await fixture(t, { now: () => wall, monotonic: () => wall });
  await service.write(request(service.load()));
  for (let day = 0; day < 18; day++) {
    wall += 86400000;
    await service.backups.capture('daily'); wall += 1000; await service.backups.capture('extra');
  }
  const entries = service.backups.list();
  assert.equal(entries.filter(e => wall - Date.parse(e.createdAt) <= 86400000).length, 2);
  assert.equal(entries.length, 16);
  const ids = entries.map(e => e.id);
  await pruneSnapshots(join(dir, 'backups'), wall - 30 * 86400000);
  assert.deepEqual(service.backups.list().map(e => e.id), ids);
});

test('backups: validation happens before publishing even if the copy operation returns corrupt domain data', async t => {
  const { DatabaseSync, backup } = await import('node:sqlite');
  let corrupt = true;
  const { service } = await fixture(t, { backupImpl: async (db, path) => {
    await backup(db, path);
    if (corrupt) {
      const copy = new DatabaseSync(path);
      const record = JSON.parse(copy.prepare('SELECT record FROM document').get().record);
      record.document.ingredients = [{ broken: true }];
      copy.prepare('UPDATE document SET record=?').run(JSON.stringify(record)); copy.close();
    }
  } });
  await service.write(request(service.load()));
  await assert.rejects(service.backups.capture('test'), /verified backup/);
  assert.equal(service.backups.list().length, 0);
  assert.equal(service.backups.status().dirty, true);
  corrupt = false;
});

test('backups: ordinary scheduler completes before five minutes; daily idle snapshots keep external copies fresh', async t => {
  let wall = Date.now(), mono = 0;
  const { service } = await fixture(t, { now: () => wall, monotonic: () => mono });
  await service.write(request(service.load()));
  wall += 4 * 60000; mono += 4 * 60000;
  await service.backups.tick();
  assert.equal(service.backups.list()[0].reason, 'automatic');
  assert.equal(service.backups.status().dirty, false);
  wall += 86400000; mono += 86400000;
  await service.backups.tick();
  assert.equal(service.backups.list()[0].reason, 'daily');
});

test('backups: emergency intent prevents normal startup and resumes safely preserving the earlier archive', async t => {
  const { writeFileSync, mkdirSync, readFileSync } = await import('node:fs');
  const { recoverFromBackup } = await import('../../server/recovery.js');
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-recover-intent-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const service = await backups.openLocalStorage(dir, { timers: false });
  await service.write(request(service.load())); await service.backups.capture('test');
  const id = service.backups.list()[0].id; await service.close();
  const archive = 'recovery-' + crypto.randomUUID(); mkdirSync(join(dir, archive));
  writeFileSync(join(dir, archive, 'menupilot.db'), 'original damaged database');
  writeFileSync(join(dir, 'recovery-pending.json'), JSON.stringify({ backupId: id, archive, status: 'prepared' }));
  await assert.rejects(backups.openLocalStorage(dir, { timers: false }), { code: 'recovery-pending' });
  await recoverFromBackup(dir, id);
  assert.equal(readFileSync(join(dir, archive, 'menupilot.db'), 'utf8'), 'original damaged database');
  assert.ok(readdirSync(join(dir, archive)).some(n => n.startsWith('menupilot.db.attempt-')));
});

test('backups: integrity_check catches SQLite check-constraint corruption before publication', async t => {
  const { DatabaseSync, backup } = await import('node:sqlite');
  let corrupt = true;
  const { service } = await fixture(t, { backupImpl: async (db, path) => {
    await backup(db, path);
    if (corrupt) {
      const copy = new DatabaseSync(path);
      copy.exec('CREATE TABLE damage(n INTEGER CHECK(n>0)); PRAGMA ignore_check_constraints=ON; INSERT INTO damage VALUES(0);'); copy.close();
    }
  } });
  await service.write(request(service.load()));
  await assert.rejects(service.backups.capture('test'), /verified backup/);
  assert.equal(service.backups.list().length, 0);
  corrupt = false;
});

test('backups: verify rejects a copy whose revision metadata differs from its document', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const { service, dir } = await fixture(t);
  await service.write(request(service.load())); await service.backups.capture('test');
  const id = service.backups.list()[0].id;
  const db = new DatabaseSync(join(dir, 'backups', id + '.sqlite'));
  const manifest = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='snapshot'").get().value);
  manifest.revision++;
  db.prepare("UPDATE meta SET value=? WHERE key='snapshot'").run(JSON.stringify(manifest)); db.close();
  await assert.rejects(service.backups.verify(id), /could not be restored/);
});
