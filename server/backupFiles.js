import { DatabaseSync, backup } from 'node:sqlite';
import { openSync, closeSync, fsyncSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, chmodSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseBackup } from '../src/store/serialization.js';
import { assertValidDocument, emptyDocument } from '../src/store/schema.js';
import { StoreError } from '../src/store/errors.js';

export const SNAPSHOT_BUDGET = { count: 512, bytes: 2 * 1024 ** 3 };
export const DAY_MS = 86400000;
const ID = /^\d{13}-[a-f0-9-]{36}$/;
export function backupPath(dir, id) {
  if (typeof id !== 'string' || !ID.test(id)) throw new StoreError('invalid', 'Provide a backup ID from backup list.');
  return join(dir, id + '.sqlite');
}
export function syncPath(path) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function readRecord(db) {
  const records = db.prepare('SELECT id,record FROM document').all();
  if (records.length > 1 || (records.length === 1 && records[0].id !== 1)) throw new Error('Invalid document singleton');
  const raw = records[0]?.record;
  if (!raw) return { document: emptyDocument(), schemaVersion: 2, documentId: null, revision: 0 };
  const record = JSON.parse(raw);
  if (record.documentId === null && record.schemaVersion === 2 && record.revision === 0) {
    assertValidDocument(record.document); return record;
  }
  return parseBackup(JSON.stringify({ version: 2, ...record }));
}
/** Also used on the restored temporary database, never on an unchecked published file. */
export function inspectDatabase(path, { metadata = true } = {}) {
  // On the supported SQLite builds a read-only integrity_check omits CHECK
  // constraint failures. Inspect the isolated writable copy with no writes.
  const db = new DatabaseSync(path);
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('integrity');
    const dbVersion = db.prepare('PRAGMA user_version').get().user_version;
    if (![1, 2].includes(dbVersion)) throw new Error('version');
    const record = readRecord(db);
    for (const row of db.prepare('SELECT raw FROM history').all()) {
      const r = JSON.parse(row.raw);
      if (r.documentId === null && r.revision === 0 && r.schemaVersion === 2) assertValidDocument(r.document);
      else parseBackup(JSON.stringify({ version: 2, ...r }));
    }
    for (const [table, column] of [['ops', 'receipt'], ['journal', 'entry'], ['plans', 'plan']]) {
      for (const row of db.prepare(`SELECT ${column} AS value FROM ${table}`).all()) JSON.parse(row.value);
    }
    const manifest = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='snapshot'").get()?.value ?? 'null');
    if (metadata && (!manifest || !ID.test(manifest.id) || manifest.documentId !== record.documentId ||
      manifest.revision !== record.revision || manifest.dbVersion !== dbVersion || !Number.isSafeInteger(manifest.sequence) || manifest.sequence < 1 ||
      !Number.isFinite(Date.parse(manifest.createdAt)))) throw new Error('metadata');
    return { record, metadata: manifest, dbVersion };
  } finally { db.close(); }
}
export function listSnapshots(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.sqlite') || !ID.test(name.slice(0, -7))) continue;
    const path = join(dir, name);
    try {
      const db = new DatabaseSync(path, { readOnly: true });
      let manifest;
      try { manifest = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='snapshot'").get()?.value ?? 'null'); }
      finally { db.close(); }
      if (!manifest || manifest.id !== name.slice(0, -7) || !Number.isSafeInteger(manifest.sequence) || !Number.isFinite(Date.parse(manifest.createdAt))) throw new Error();
      entries.push({ ...manifest, bytes: statSync(path).size });
    } catch { entries.push({ id: name.slice(0, -7), invalid: true, bytes: statSync(path).size, sequence: -1 }); }
  }
  return entries.sort((a, b) => b.sequence - a.sequence || b.id.localeCompare(a.id));
}
/** Keep all of the last day, then the latest snapshot on each of 14 older UTC days.
 * Future timestamps (clock rollback) are retained. Budgets refuse new copies instead
 * of silently shortening this promised window. Corrupt files are never auto-deleted. */
export function pruneSnapshots(dir, now) {
  const days = new Set();
  for (const item of listSnapshots(dir)) {
    if (item.invalid || now - Date.parse(item.createdAt) <= DAY_MS) continue;
    const day = item.createdAt.slice(0, 10);
    if (!days.has(day) && days.size < 14) { days.add(day); continue; }
    unlinkSync(backupPath(dir, item.id));
  }
}
export async function publishSnapshot(db, dir, { now = Date.now(), reason, sequence, backupImpl = backup, budget = SNAPSHOT_BUDGET } = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  pruneSnapshots(dir, now);
  const entries = listSnapshots(dir);
  const estimatedBytes = db.prepare('PRAGMA page_count').get().page_count * db.prepare('PRAGMA page_size').get().page_size + 65536;
  if (entries.length >= budget.count || entries.reduce((sum, e) => sum + e.bytes, 0) + estimatedBytes > budget.bytes) {
    throw new StoreError('backup-quota', 'Backup storage budget reached. Free space or archive older backups; the replacement was not performed.');
  }
  const id = `${String(now).padStart(13, '0')}-${randomUUID()}`;
  const target = backupPath(dir, id), partial = target + '.partial';
  try {
    await backupImpl(db, partial);
    chmodSync(partial, 0o600);
    const copy = new DatabaseSync(partial);
    try {
      copy.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
      const record = readRecord(copy);
      const manifest = { id, documentId: record.documentId, revision: record.revision,
        createdAt: new Date(now).toISOString(), dbVersion: copy.prepare('PRAGMA user_version').get().user_version,
        reason, sequence: sequence ?? Math.max(0, ...entries.map(e => e.sequence)) + 1 };
      copy.prepare("INSERT INTO meta(key,value) VALUES('snapshot',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(manifest));
    } finally { copy.close(); }
    const checked = inspectDatabase(partial);
    syncPath(partial);
    renameSync(partial, target); // Only verified, complete files have the public suffix.
    syncPath(dir);
    return checked.metadata;
  } catch (error) {
    throw new StoreError('backup-failed', 'A verified backup could not be created. Check disk space and folder permissions. The replacement was not performed.', [error.code ?? 'backup']);
  } finally {
    for (const path of [partial, partial + '-journal', partial + '-wal', partial + '-shm']) {
      try { unlinkSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}
/** Actual SQLite restore into a disposable database, followed by full checks. */
export async function verifySnapshot(dir, id) {
  const source = backupPath(dir, id), temp = await mkdtemp(join(tmpdir(), 'menupilot-verify-'));
  let db;
  try {
    db = new DatabaseSync(source, { readOnly: true });
    const destination = join(temp, 'restored.db');
    await backup(db, destination);
    const checked = inspectDatabase(destination);
    if (checked.metadata.id !== id) throw new Error('identity');
    return checked;
  } catch { throw new StoreError('backup-invalid', 'This backup could not be restored and verified. Choose another backup.'); }
  finally { db?.close(); await rm(temp, { recursive: true, force: true }); }
}
