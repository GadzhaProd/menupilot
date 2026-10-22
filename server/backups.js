import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, unlinkSync, renameSync, statSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createSqliteStorage } from './sqlite.js';
import { StoreError } from '../src/store/errors.js';
import { backupPath, publishSnapshot, listSnapshots, verifySnapshot, verifyOrQuarantine, inspectDatabase, syncPath, pruneSnapshots, auditSnapshots, DAY_MS, SNAPSHOT_BUDGET } from './backupFiles.js';

export const RPO_MS = 5 * 60 * 1000;
const CAPTURE_AFTER_MS = 4 * 60 * 1000; // Reserve one minute for completing the copy.
const meta = (db, key) => db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value;
const put = (db, key, value) => db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));

/** Caller owns the process lock before this opens the main database. */
export async function openLocalStorage(dir, options = {}) {
  if (existsSync(join(dir, 'recovery-pending.json'))) throw new StoreError('recovery-pending', 'Emergency recovery was interrupted. Run doctor --recover-from-backup with the same backup ID.');
  const path = join(dir, 'menupilot.db'), backupDir = join(dir, 'backups');
  let migrationApproved = false;
  if (existsSync(path)) {
    let db;
    try {
      db = new DatabaseSync(path, { readOnly: true });
      const dbVersion = db.prepare('PRAGMA user_version').get().user_version;
      if (dbVersion > 2) throw new StoreError('unsupported-version', 'This database needs a newer MenuPilot.');
      if (dbVersion === 1) {
        await publishSnapshot(db, backupDir, { reason: 'before-migration', now: (options.now ?? Date.now)(), backupImpl: options.backupImpl, retentionPaused: () => true });
        migrationApproved = true;
      }
      const pristine = dbVersion === 0 && db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type='table'").get().n === 0;
      db.close(); db = undefined;
      if (!pristine) inspectDatabase(path, { metadata: false });
    } catch (error) {
      if (error instanceof StoreError) throw error;
      throw new StoreError('database-corrupt', 'The database could not be verified. Stop MenuPilot and use doctor --recover-from-backup <id>. Keep the original files.');
    } finally { db?.close(); }
  }
  const raw = createSqliteStorage(path, { migrationApproved, now: options.now });
  try { return await manageBackups(raw, dir, options); }
  catch (error) { raw.close(); throw error; }
}

/** All production mutations and snapshots share this queue. No transaction stays
 * open across SQLite backup(): the process lock excludes other server writers. */
export async function manageBackups(raw, dir, { now = Date.now, monotonic = () => performance.now(), timers = true,
  externalDir = process.env.MENUPILOT_BACKUP_DIR, backupImpl, copyImpl = copyFile, budget } = {}) {
  const folder = join(dir, 'backups');
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  // These are our unpublished files, left by an interrupted backup. Never list them.
  for (const name of readdirSync(folder)) if (/^\d{13}-[a-f0-9-]{36}\.sqlite\.partial(?:-journal|-wal|-shm)?$/.test(name)) unlinkSync(join(folder, name));
  const db = raw.db;
  if (!meta(db, 'backupInstallation')) put(db, 'backupInstallation', randomUUID());
  const external = externalDir ? resolve(externalDir) : null;
  let queue = Promise.resolve(), timer, closed = false, closing;
  let backupError = null, externalError = null, failures = 0, retryAt = 0, auditAt = 0;
  let dirtyMono = null, dirtyWall = null, lastWall = now(), lastMono = monotonic();
  let clockWarning = meta(db, 'backupClockWarning') === '1';
  const latestAt = Date.parse(listSnapshots(folder).find(e => !e.invalid)?.createdAt ?? '');
  let dailyDue = lastMono + DAY_MS - Math.max(0, Math.min(DAY_MS, lastWall - (Number.isFinite(latestAt) ? latestAt : lastWall)));
  function markClockJump() {
    clockWarning = true;
    put(db, 'backupClockWarning', '1'); // A restart cannot quietly authorize deletion.
    dailyDue = Math.min(dailyDue, monotonic());
  }
  if (latestAt > lastWall) markClockJump();
  const retentionPaused = () => { observe(); return clockWarning; };
  const enqueue = fn => {
    if (closed) return Promise.reject(new StoreError('stopping', 'MenuPilot is stopping. Start npm start and retry.'));
    const result = queue.then(fn); queue = result.catch(() => {}); return result;
  };
  const dirty = () => meta(db, 'backupDirty') === '1';
  function observe() {
    const wall = now(), mono = monotonic();
    if (wall < lastWall || Math.abs((wall - lastWall) - (mono - lastMono)) > 60000) markClockJump();
    lastWall = wall; lastMono = mono;
    if (dirty()) {
      if (dirtyMono === null) { dirtyMono = monotonic(); dirtyWall = Date.parse(meta(db, 'backupDirtySince') ?? '');
        if (dirtyWall > wall) markClockJump(); }
    } else { dirtyMono = null; dirtyWall = null; }
  }
  function dirtyAge() {
    observe();
    if (dirtyMono === null) return 0;
    return Math.max(monotonic() - dirtyMono, Number.isFinite(dirtyWall) ? now() - dirtyWall : RPO_MS);
  }
  function lastExternal() {
    try { const value = JSON.parse(meta(db, 'lastExternalBackup') ?? 'null'); return value?.folder === external ? value : null; }
    catch { return null; }
  }
  async function exportReady() {
    if (!external || monotonic() < retryAt || monotonic() < auditAt) return;
    let partial;
    try {
      if (!statSync(external).isDirectory()) throw new Error('folder');
      const destination = join(external, 'menupilot-' + meta(db, 'backupInstallation'));
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      const validExternal = await auditSnapshots(destination);
      const exported = new Set(validExternal.map(e => e.id));
      const prior = lastExternal();
      if (prior && !exported.has(prior.id)) db.prepare("DELETE FROM meta WHERE key='lastExternalBackup'").run();
      const validLocal = await auditSnapshots(folder);
      // Newest first: a backlog must not delay the freshest independent copy.
      for (const item of validLocal) {
        const target = backupPath(destination, item.id);
        if (!exported.has(item.id)) {
          const files = listSnapshots(destination);
          if (files.length >= SNAPSHOT_BUDGET.count || files.reduce((sum, e) => sum + e.bytes, 0) + item.bytes > SNAPSHOT_BUDGET.bytes) throw new Error('external quota');
          await verifySnapshot(folder, item.id);
          partial = target + '.partial';
          await copyImpl(backupPath(folder, item.id), partial);
          const checked = inspectDatabase(partial);
          if (checked.metadata.id !== item.id) throw new Error('identity');
          syncPath(partial); renameSync(partial, target); partial = undefined; syncPath(destination);
        }
        const last = lastExternal();
        if (!last || item.sequence > last.sequence) put(db, 'lastExternalBackup', JSON.stringify({ ...item, folder: external, copiedAt: new Date(now()).toISOString() }));
      }
      await pruneSnapshots(destination, now(), { retentionPaused });
      externalError = null; failures = 0; retryAt = 0;
      auditAt = monotonic() + 60000; // Restore-tests are bounded to once per minute when idle.
    } catch {
      externalError = 'external-unavailable';
      retryAt = monotonic() + Math.min(5 * 60 * 1000, 1000 * 2 ** Math.min(failures++, 9));
    } finally {
      if (partial) { try { unlinkSync(partial); } catch { /* A disconnected external disk can retain an unpublished temporary file. */ } }
    }
  }
  async function capture(reason) {
    observe();
    try {
      const entry = await publishSnapshot(db, folder, { reason, now: now(), backupImpl, budget, retentionPaused });
      // Durable publication precedes clearing the persisted dirty flag. A crash
      // between them causes a harmless extra snapshot on the next startup.
      db.exec('BEGIN IMMEDIATE');
      try {
        put(db, 'lastBackup', JSON.stringify(entry)); put(db, 'backupDirty', '0');
        db.prepare("DELETE FROM meta WHERE key='backupDirtySince'").run();
        db.exec('COMMIT');
      } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
      dailyDue = monotonic() + DAY_MS; auditAt = 0; // New snapshots export immediately.
      dirtyMono = null; dirtyWall = null; backupError = null;
      return entry;
    } catch (error) { backupError = error.code ?? 'backup-failed'; throw error; }
  }
  async function write(input, actor = 'ui', internal) {
    const current = raw.version();
    const replay = input && db.prepare('SELECT 1 FROM ops WHERE id=?').get(typeof input.opId === 'string' ? input.opId : '');
    if (input && ['import', 'restore', 'reset', 'memory', 'backup-restore'].includes(input.kind) && !replay &&
      input.expectedDocumentId === current.documentId && input.expectedRevision === current.revision) await capture('before-' + input.kind);
    const result = raw.write(input, actor, internal);
    observe();
    return result;
  }
  function externalCorruptionCount() {
    if (!external) return 0;
    try { return listSnapshots(join(external, 'menupilot-' + meta(db, 'backupInstallation'))).filter(e => e.invalid).length; }
    catch { return null; }
  }
  function status() {
    const age = dirtyAge(), last = listSnapshots(folder).find(e => !e.invalid), ext = lastExternal();
    return { lastBackupAt: last?.createdAt ?? null, lastBackupRevision: last?.revision ?? null,
      lastExternalBackupAt: ext?.copiedAt ?? null, lastExternalSnapshotAt: ext?.createdAt ?? null,
      externalConfigured: !!external, dirty: dirty(), overdue: dirty() && age > RPO_MS,
      externalOverdue: !!external && (!ext || now() - Date.parse(ext.copiedAt) > DAY_MS || now() < Date.parse(ext.copiedAt)),
      backupError, externalError, clockWarning, retentionPaused: clockWarning,
      corruptBackups: listSnapshots(folder).filter(e => e.invalid).length,
      corruptExternalBackups: externalCorruptionCount() };
  }
  async function tick() {
    observe(); // Detect forward AND backward jumps even when no UI polls status.
    if (dirty() && (dirtyAge() >= CAPTURE_AFTER_MS || clockWarning)) {
      try { await capture('automatic'); } catch { /* Keep dirty and make failure visible; retry next tick. */ }
    } else if (!dirty()) {
      const latest = listSnapshots(folder).find(e => !e.invalid);
      if (latest && monotonic() >= dailyDue) {
        try { await capture('daily'); } catch { /* Visible in status. */ }
      }
    }
    await exportReady();
  }
  const service = {
    load: raw.load, version: raw.version, history: raw.history, journal: raw.journal,
    write: (input, actor) => enqueue(() => write(input, actor)),
    plans: Object.fromEntries(Object.entries(raw.plans).map(([name, fn]) => [name, (...args) => enqueue(() => { const result = fn(...args); observe(); return result; })])),
    backups: {
      list: () => listSnapshots(folder), status,
      capture: reason => enqueue(async () => { const result = await capture(reason); await exportReady(); return result; }),
      verify: id => enqueue(() => verifyOrQuarantine(folder, id)),
      tick: () => enqueue(tick),
      restore: (input, actor = 'cli') => enqueue(async () => {
        if (!input || Object.keys(input).some(k => !['id', 'expectedDocumentId', 'expectedRevision', 'opId'].includes(k))) throw new StoreError('invalid', 'Invalid backup restore request.');
        // Receipt replay must still work after the source has aged out of retention.
        const old = db.prepare('SELECT 1 FROM ops WHERE id=?').get(typeof input.opId === 'string' ? input.opId : '');
        const checked = old ? null : await verifyOrQuarantine(folder, input.id);
        return write({ ...input, kind: 'backup-restore' }, actor, { restoreDocument: checked?.record.document });
      }),
    },
    close() {
      return closing ??= (async () => {
        clearTimeout(timer); closed = true; await queue;
        try { if (dirty()) await capture('shutdown'); await exportReady(); }
        finally { raw.close(); }
      })();
    },
  };
  try { await auditSnapshots(folder); } catch (error) { backupError = error.code ?? 'backup-unverified'; }
  observe();
  if (dirty()) { try { await capture('startup'); } catch { /* Ordinary saves remain available, with a visible backup warning. */ } }
  await exportReady();
  function schedule() {
    if (closed) return;
    timer = setTimeout(() => { void enqueue(tick).catch(() => {}).finally(schedule); }, 1000); timer.unref();
  }
  if (timers) schedule();
  return service;
}
