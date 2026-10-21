import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openLocalStorage } from '../../server/backups.js';
import { DAY_MS, verifySnapshot } from '../../server/backupFiles.js';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-retention-'));
  const externalDir = join(dir, 'external'); mkdirSync(externalDir);
  const clock = { wall: Date.UTC(2026, 0, 1), mono: 0, failBackup: false, failCopy: false };
  const options = { timers: false, now: () => clock.wall, monotonic: () => clock.mono, externalDir,
    backupImpl: (...args) => { if (clock.failBackup) throw new Error('disk full'); return backup(...args); },
    copyImpl: (...args) => { if (clock.failCopy) throw new Error('external full'); return copyFile(...args); } };
  let service = await openLocalStorage(dir, options);
  t.after(async () => { clock.failBackup = false; clock.failCopy = false; await service.close(); rmSync(dir, { recursive: true }); });
  const local = join(dir, 'backups');
  const external = () => join(externalDir, readdirSync(externalDir)[0]);
  async function capture() {
    const current = service.load();
    const document = structuredClone(current.document); document.settings.defaultVatRateBp++;
    await service.write({ kind: 'save', document, expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: crypto.randomUUID() });
    const entry = await service.backups.capture('test');
    clock.wall += 60000; clock.mono += 60000;
    return entry;
  }
  return { dir, local, external, clock, capture, get service() { return service; },
    async reopen() { await service.close(); service = await openLocalStorage(dir, options); } };
}
function corrupt(dir, id) {
  const db = new DatabaseSync(join(dir, id + '.sqlite'));
  const record = JSON.parse(db.prepare('SELECT record FROM document').get().record);
  record.document.ingredients = [{ broken: true }];
  db.prepare('UPDATE document SET record=?').run(JSON.stringify(record)); db.close();
}

for (const location of ['local', 'external']) {
  test(`retention ${location}: corrupt newer candidate and failed replacement preserve good fallback`, async t => {
    const f = await fixture(t), good = await f.capture(), bad = await f.capture();
    const folder = location === 'local' ? f.local : f.external();
    corrupt(folder, bad.id);
    f.clock.wall += 2 * DAY_MS; f.clock.mono += 2 * DAY_MS;
    if (location === 'local') {
      f.clock.failBackup = true;
      await assert.rejects(f.service.backups.capture('failed'), /backup/);
    } else {
      f.clock.failCopy = true;
      await f.service.backups.capture('external-failed');
    }
    assert.equal(existsSync(join(folder, good.id + '.sqlite')), true, 'last good restore point must survive');
    await verifySnapshot(folder, good.id);
    assert.equal(existsSync(join(folder, bad.id + '.sqlite')), false, 'corrupt candidate is quarantined');
    const status = f.service.backups.status();
    assert.ok(location === 'local' ? status.corruptBackups > 0 : status.corruptExternalBackups > 0);
    f.clock.failBackup = false; f.clock.failCopy = false;
    f.clock.wall += 10 * DAY_MS; f.clock.mono += 10 * DAY_MS;
    await f.service.backups.capture('replacement');
    const files = readdirSync(folder).filter(n => n.endsWith('.sqlite'));
    assert.ok(files.length >= 2, 'keep a verified spare behind the replacement');
    for (const file of files) await verifySnapshot(folder, file.slice(0, -7));
  });
}

for (const jump of [DAY_MS, 7 * DAY_MS, -7 * DAY_MS]) {
  test(`clock jump ${jump / DAY_MS} days: protect both folders and resume daily snapshots after correction`, async t => {
    const f = await fixture(t), ids = [];
    for (let i = 0; i < 4; i++) ids.push((await f.capture()).id);
    const correct = f.clock.wall;
    f.clock.wall += jump; f.clock.mono += 1000;
    await f.service.backups.tick(); // No status poll to detect the jump for us.
    for (const folder of [f.local, f.external()]) {
      for (const id of ids) assert.equal(existsSync(join(folder, id + '.sqlite')), true, 'clock jump must not expire recent copies');
    }
    assert.equal(f.service.backups.status().clockWarning, true);
    assert.equal(f.service.backups.status().retentionPaused, true);
    f.clock.wall = correct + 2000; f.clock.mono += 1000;
    await f.service.backups.tick();
    const previous = f.service.backups.list().filter(e => !e.invalid)[0];
    f.clock.wall += DAY_MS; f.clock.mono += DAY_MS;
    await f.service.backups.tick();
    const latest = f.service.backups.list().filter(e => !e.invalid)[0];
    assert.notEqual(latest.id, previous.id, 'future-dated copies must not stall the daily timer');
    assert.equal(latest.reason, 'daily');
    await verifySnapshot(f.external(), latest.id);
    for (const folder of [f.local, f.external()]) for (const id of ids) await verifySnapshot(folder, id);
    await f.reopen();
    assert.equal(f.service.backups.status().retentionPaused, true, 'restart must not silently resume unsafe deletion');
  });
}

for (const location of ['local', 'external']) {
  test(`retention ${location}: retain a verified spare even when both copies share one old UTC day`, async t => {
    const { pruneSnapshots } = await import('../../server/backupFiles.js');
    const f = await fixture(t);
    await f.capture(); const spare = await f.capture(), latest = await f.capture();
    const folder = location === 'local' ? f.local : f.external();
    await pruneSnapshots(folder, f.clock.wall + 20 * DAY_MS);
    await verifySnapshot(folder, latest.id);
    await verifySnapshot(folder, spare.id);
    assert.equal(readdirSync(folder).filter(n => n.endsWith('.sqlite')).length, 2);
  });
}
