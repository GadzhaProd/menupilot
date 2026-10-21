import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, statfsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { acquireLock } from './lock.js';
import { privateFile } from './session.js';
import { backupPath, inspectDatabase, syncPath, verifySnapshot } from './backupFiles.js';
import { StoreError } from '../src/store/errors.js';

export function dataLocationWarning(dir) {
  // Heuristics cannot identify every sync client or mount. Warn conservatively.
  const cloud = /(?:CloudStorage|Mobile Documents|iCloud|Dropbox|OneDrive|Google Drive|GoogleDrive|Nextcloud|\/Volumes\/|\/net\/|\/mnt\/)/i.test(dir);
  let network = false;
  try { network = [0x6969, 0x517b, 0xff534d42, 0x65735546].includes(Number(statfsSync(dir).type)); } catch { network = true; }
  return cloud || network ? 'Warning: the live database may be in a cloud or network folder. Use a local disk for MENUPILOT_DATA_DIR; set MENUPILOT_BACKUP_DIR for copies only.' : null;
}

/** Offline only, under the same process lock as npm start. An intent file makes
 * interrupted multi-file moves fail closed on the next normal startup. */
export async function recoverFromBackup(dir, id) {
  const lock = await acquireLock(dir, 'offline-recovery', { waitMs: 0 });
  const pending = join(dir, 'recovery-pending.json'), staged = join(dir, 'recovery.sqlite.partial');
  try {
    const checked = await verifySnapshot(join(dir, 'backups'), id);
    let report;
    if (existsSync(pending)) {
      report = JSON.parse(readFileSync(pending, 'utf8'));
      if (report.backupId !== id || !/^recovery-[a-f0-9-]{36}$/.test(report.archive)) throw new StoreError('recovery-pending', 'Repeat recovery with the same backup ID recorded in recovery-pending.json.');
    } else report = { backupId: id, archive: 'recovery-' + randomUUID(), startedAt: new Date().toISOString(), snapshot: checked.metadata, status: 'prepared' };
    const archive = join(dir, report.archive);
    mkdirSync(archive, { recursive: true, mode: 0o700 });
    for (const file of [staged, staged + '-journal', staged + '-wal', staged + '-shm']) {
      try { unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const source = new DatabaseSync(backupPath(join(dir, 'backups'), id), { readOnly: true });
    try { await backup(source, staged); } finally { source.close(); }
    chmodSync(staged, 0o600);
    inspectDatabase(staged);
    const restored = new DatabaseSync(staged);
    try {
      restored.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;');
      // Emergency recovery cannot know the lost high-water revision. A new
      // identity prevents pre-failure clients from matching CAS accidentally.
      const record = { ...checked.record, documentId: randomUUID(), revision: checked.record.revision + 1 };
      if (!Number.isSafeInteger(record.revision)) throw new Error('revision exhausted');
      restored.prepare('INSERT INTO document(id,record) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(JSON.stringify(record));
      restored.exec("DELETE FROM ops; DELETE FROM plans; DELETE FROM meta WHERE key IN ('snapshot','lastExternalBackup','lastBackup','backupDirtySince');");
      restored.prepare("INSERT INTO meta(key,value) VALUES('backupDirty','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
      restored.prepare("INSERT INTO meta(key,value) VALUES('backupDirtySince',?)").run(new Date().toISOString());
      const entry = JSON.stringify({ kind: 'emergency-recovery', source: 'cli', at: new Date().toISOString(), backupId: id, documentId: record.documentId, revision: record.revision });
      restored.prepare('INSERT INTO journal(entry,bytes) VALUES(?,?)').run(entry, Buffer.byteLength(entry));
      restored.exec('COMMIT');
      report.recoveredDocumentId = record.documentId; report.recoveredRevision = record.revision;
    } finally { restored.close(); }
    inspectDatabase(staged, { metadata: false }); syncPath(staged);
    privateFile(dir, 'recovery-pending.json', JSON.stringify(report, null, 2)); syncPath(dir);
    // Move originals, including WAL, without opening/checkpointing the corrupt DB.
    for (const suffix of ['', '-wal', '-shm']) {
      const name = 'menupilot.db' + suffix, original = join(dir, name), saved = join(archive, name);
      if (existsSync(original)) {
        if (existsSync(saved)) {
          // A prior attempt may already have installed a recovered DB. Preserve
          // that attempt too instead of overwriting any original evidence.
          renameSync(original, join(archive, name + '.attempt-' + randomUUID()));
        } else renameSync(original, saved);
      }
    }
    syncPath(archive); syncPath(dir);
    renameSync(staged, join(dir, 'menupilot.db')); syncPath(dir);
    report.status = 'recovered'; report.completedAt = new Date().toISOString();
    privateFile(archive, 'report.json', JSON.stringify(report, null, 2)); syncPath(archive);
    unlinkSync(pending); syncPath(dir);
    return { ...report, reportPath: join(archive, 'report.json') };
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError('recovery-failed', 'Recovery could not finish. Original files are preserved. Check disk space and repeat the same doctor command.');
  } finally { await lock.release(); }
}
