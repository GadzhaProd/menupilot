import { mkdirSync, realpathSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, openSync, fsyncSync, closeSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { StoreError } from '../src/store/errors.js';

export const LOCK_GRACE_MS = 5000;
export const GUARD_GRACE_MS = 30000;
export function canonicalDataDir(path = process.env.MENUPILOT_DATA_DIR) {
  if (!['darwin', 'linux'].includes(process.platform)) throw new StoreError('unsupported-platform', 'Local preview supports macOS and Linux.');
  const target = resolve(path || (process.platform === 'darwin'
    ? join(homedir(), 'Library/Application Support/MenuPilot')
    : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'menupilot')));
  mkdirSync(target, { recursive: true, mode: 0o700 });
  return realpathSync(target);
}
function problem(dir, file, code, message, instruction = 'Stop the existing MenuPilot process, then run npm start again.') {
  return new StoreError(code, `${message}\nData folder: ${dir}\nLock file: ${join(dir, file)}\n${instruction}`);
}
export function processIdentity(pid) {
  if (process.platform === 'linux') {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return { bootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(),
      processStart: stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] };
  }
  const options = { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'pipe'] };
  const processStart = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart='], options).trim();
  const bootId = execFileSync('/usr/sbin/sysctl', ['-n', 'kern.bootsessionuuid'], options).trim();
  if (!processStart || !bootId) throw new Error('Process identity unavailable');
  return { bootId, processStart };
}
// Only positive evidence of death or a different process permits reclamation.
function isStale(owner) {
  try { process.kill(owner.pid, 0); }
  catch (error) { return error.code === 'ESRCH'; }
  if (!owner.bootId || !owner.processStart) return false; // legacy live PID: fail closed
  try {
    const actual = processIdentity(owner.pid);
    return actual.bootId !== owner.bootId || actual.processStart !== owner.processStart;
  } catch { return false; }
}
function readOwner(path) {
  try {
    const owner = JSON.parse(readFileSync(path, 'utf8'));
    return Number.isSafeInteger(owner?.pid) && owner.pid > 0 && typeof owner.instanceId === 'string' && owner.instanceId && typeof owner.address === 'string' ? owner : undefined;
  } catch (error) { if (error.code === 'ENOENT') return null; if (error instanceof SyntaxError) return undefined; throw error; }
}
function age(path) { return Date.now() - statSync(path).mtimeMs; }

// OS-managed SQLite locks serialize recovery of the filesystem guard, including
// two simultaneous stale-guard reapers. Never unlink this coordination database.
// The application database is still opened only after acquiring the writer lock.
function guarded(dir, owner, work) {
  const guard = join(dir, 'lock.guard'), marker = join(guard, 'owner');
  const coordinator = new DatabaseSync(join(dir, 'lock-coordinator.sqlite'));
  let transaction = false, held = false;
  try {
    coordinator.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;'); transaction = true;
    try { mkdirSync(guard, { mode: 0o700 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const previous = readOwner(marker);
      if (age(guard) < GUARD_GRACE_MS || (previous && !isStale(previous))) {
        throw problem(dir, 'lock.guard', 'lock-busy', 'MenuPilot lock maintenance is in progress or was interrupted.', 'Wait 30 seconds, then run npm start again.');
      }
      // Only our known marker is removed. Unexpected contents fail closed.
      if (previous !== null) unlinkSync(marker);
      rmdirSync(guard); mkdirSync(guard, { mode: 0o700 });
    }
    held = true; writeFileSync(marker, JSON.stringify(owner), { mode: 0o600 });
    return work();
  } finally {
    try { if (held) { unlinkSync(marker); rmdirSync(guard); } }
    finally { try { if (transaction) coordinator.exec('COMMIT'); } finally { coordinator.close(); } }
  }
}
async function probe(owner) {
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(owner.address)) return false;
  try {
    const response = await fetch(`${owner.address}/menupilot-instance`, { signal: AbortSignal.timeout(300), redirect: 'error' });
    const body = await response.json();
    return response.ok && body.service === 'MenuPilot' && body.instanceId === owner.instanceId;
  } catch { return false; }
}
export async function acquireLock(dir, address, { waitMs = 10000 } = {}) {
  const path = join(dir, 'lock');
  let identity;
  try { identity = processIdentity(process.pid); }
  catch { throw problem(dir, 'lock', 'lock-uncertain', 'Cannot verify this process start time and boot identity.', 'Allow process inspection, then run npm start again.'); }
  const owner = { pid: process.pid, instanceId: randomUUID(), address, ...identity };
  const deadline = Date.now() + waitMs;
  for (;;) {
    let previous;
    try {
      previous = guarded(dir, owner, () => {
        const existing = readOwner(path);
        if (existing && !isStale(existing)) return existing;
        if (existing === undefined && age(path) < LOCK_GRACE_MS) throw problem(dir, 'lock', 'lock-busy', 'The MenuPilot lock is incomplete and may still be initializing.', 'Wait 5 seconds, then run npm start again.');
        if (existing !== null) unlinkSync(path);
        const fd = openSync(path, 'wx', 0o600);
        try { writeFileSync(fd, JSON.stringify(owner)); fsyncSync(fd); } finally { closeSync(fd); }
        return null;
      });
    } catch (error) {
      if (error.code === 'lock-busy' && Date.now() < deadline) { await delay(100); continue; }
      throw error instanceof StoreError ? error : problem(dir, 'lock', 'lock-uncertain', 'Cannot safely maintain the MenuPilot lock.');
    }
    if (!previous) break;
    if (await probe(previous)) throw problem(dir, 'lock', 'already-running', `MenuPilot is already running at ${previous.address}; to open it run npm run menupilot -- open-url.`, 'The existing server remains in use.');
    if (Date.now() >= deadline) throw problem(dir, 'lock', 'lock-uncertain', `The lock looks stale or MenuPilot is still starting at ${previous.address}; no matching MenuPilot instance responded. Its process may still be alive, so the lock was kept.`);
    await delay(100);
  }
  return { owner, async release() {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return guarded(dir, owner, () => {
          const current = readOwner(path);
          if (current?.instanceId !== owner.instanceId || current.pid !== owner.pid) return false;
          unlinkSync(path); return true;
        });
      } catch {
        if (attempt < 2) await delay(100);
      }
    }
    console.error(problem(dir, 'lock', 'lock-uncertain', 'MenuPilot stopped but could not release its lock.').message);
    return false; // Shutdown must never reject because cleanup failed.
  } };
}
