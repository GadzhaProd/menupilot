import { DatabaseSync, backup } from 'node:sqlite';
import { openSync, closeSync, fsyncSync, mkdirSync, readdirSync, statSync, unlinkSync, renameSync, chmodSync, existsSync } from 'node:fs';
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
  const quarantine = join(dir, 'quarantine');
  if (existsSync(quarantine)) for (const name of readdirSync(quarantine)) {
    if (!/^\d{13}-[a-f0-9-]{36}\.[a-f0-9-]{36}\.sqlite$/.test(name)) continue;
    entries.push({ id: name.slice(0, 50), invalid: true, quarantined: true,
      bytes: statSync(join(quarantine, name)).size, sequence: -1 });
  }
  return entries.sort((a, b) => b.sequence - a.sequence || b.id.localeCompare(a.id));
}
/** Never infer recoverability from a readable manifest. Failure to perform the
 * restore-test (e.g. no temporary disk space) aborts rotation without deleting. */
export async function auditSnapshots(dir) {
  const verified = [];
  for (const entry of listSnapshots(dir).filter(e => !e.quarantined)) {
    try {
      const checked = await verifyOrQuarantine(dir, entry.id);
      verified.push({ ...checked.metadata, bytes: entry.bytes });
    } catch (error) {
      if (error.code !== 'backup-invalid') throw error;
    }
  }
  return verified.sort((a, b) => b.sequence - a.sequence || b.id.localeCompare(a.id));
}
export async function verifyOrQuarantine(dir, id) {
  try { return await verifySnapshot(dir, id); }
  catch (error) {
    if (error.code === 'backup-invalid') {
      const quarantine = join(dir, 'quarantine');
      mkdirSync(quarantine, { recursive: true, mode: 0o700 });
      renameSync(backupPath(dir, id), join(quarantine, id + '.' + randomUUID() + '.sqlite'));
      syncPath(quarantine); syncPath(dir);
    }
    throw error;
  }
}
/** Publication happens before retirement. Retain the last day, 14 older daily
 * points AND a verified spare behind the newest point, regardless of its date. */
export async function pruneSnapshots(dir, now, { retentionPaused = () => false } = {}) {
  const verified = await auditSnapshots(dir);
  if (retentionPaused()) return;
  const keep = new Set(verified.slice(0, 2).map(e => e.id)), days = new Set();
  for (const item of verified) {
    if (now - Date.parse(item.createdAt) <= DAY_MS) { keep.add(item.id); continue; }
    const day = item.createdAt.slice(0, 10);
    if (!days.has(day) && days.size < 14) { days.add(day); keep.add(item.id); }
  }
  for (const item of verified) {
    if (retentionPaused()) return; // A clock jump during asynchronous verification is unsafe too.
    if (!keep.has(item.id)) unlinkSync(backupPath(dir, item.id));
  }
  syncPath(dir);
}
export async function publishSnapshot(db, dir, { now = Date.now(), reason, sequence, backupImpl = backup, budget = SNAPSHOT_BUDGET, retentionPaused = () => false } = {}) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const previous = listSnapshots(dir);
  const last = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='lastBackup'").get()?.value ?? 'null');
  const nextSequence = Math.max(0, Number.isSafeInteger(last?.sequence) ? last.sequence : 0, ...previous.map(e => e.sequence)) + 1;
  await auditSnapshots(dir);
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
        reason, sequence: sequence ?? nextSequence };
      copy.prepare("INSERT INTO meta(key,value) VALUES('snapshot',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(manifest));
    } finally { copy.close(); }
    const checked = inspectDatabase(partial);
    syncPath(partial);
    renameSync(partial, target); // Only verified, complete files have the public suffix.
    syncPath(dir);
    await pruneSnapshots(dir, now, { retentionPaused });
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
  let db, checking = false;
  try {
    db = new DatabaseSync(source, { readOnly: true });
    const destination = join(temp, 'restored.db');
    await backup(db, destination);
    checking = true;
    const checked = inspectDatabase(destination);
    if (checked.metadata.id !== id) throw new Error('identity');
    return checked;
  } catch (error) {
    if (checking || [11, 26].includes(error.errcode)) throw new StoreError('backup-invalid', 'This backup could not be restored and verified. Choose another backup.');
    throw new StoreError('backup-unverified', 'Backup verification could not run. Check disk space and permissions; existing copies have been kept.');
  }
  finally { db?.close(); await rm(temp, { recursive: true, force: true }); }
}
