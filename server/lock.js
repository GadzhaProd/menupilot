import { mkdirSync, realpathSync, readFileSync, writeFileSync, unlinkSync, rmdirSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StoreError } from '../src/store/errors.js';

export function canonicalDataDir(path = process.env.MENUPILOT_DATA_DIR) {
  if (!['darwin', 'linux'].includes(process.platform)) throw new StoreError('unsupported-platform', 'Local preview supports macOS and Linux.');
  const target = resolve(path || (process.platform === 'darwin'
    ? join(homedir(), 'Library/Application Support/MenuPilot')
    : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'menupilot')));
  mkdirSync(target, { recursive: true, mode: 0o700 });
  return realpathSync(target);
}

// Every acquire/release/reclaim participates in the same atomic mkdir guard.
// A crashed guard is NEVER stolen: uncertainty must fail closed, not permit two
// writers. It only spans synchronous filesystem calls, never DB/build/HTTP work.
function guarded(dir, work) {
  const guard = join(dir, 'lock.guard');
  try { mkdirSync(guard, { mode: 0o700 }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new StoreError('lock-uncertain', 'Lock maintenance is in progress or was interrupted. Retry; if persistent, stop all MenuPilot processes before inspecting lock.guard.');
    throw error;
  }
  try { return work(); } finally { rmdirSync(guard); }
}
function readOwner(path) {
  try {
    const owner = JSON.parse(readFileSync(path, 'utf8'));
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || typeof owner.instanceId !== 'string' || !owner.instanceId || typeof owner.address !== 'string') throw new Error('bad owner');
    return owner;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new StoreError('lock-uncertain', 'The MenuPilot lock is incomplete. Stop all MenuPilot processes before inspecting it; it was not removed.');
  }
}
export function acquireLock(dir, address) {
  const path = join(dir, 'lock');
  const owner = { pid: process.pid, instanceId: randomUUID(), address };
  guarded(dir, () => {
    const previous = readOwner(path);
    if (previous) {
      try {
        process.kill(previous.pid, 0);
        throw new StoreError('already-running', `MenuPilot is already running at ${previous.address}.`);
      } catch (error) {
        // PID reuse errs on the safe side: any live PID, including an unrelated
        // process, blocks reclamation. EPERM and all uncertainty also block it.
        if (error.code !== 'ESRCH') throw error instanceof StoreError ? error : new StoreError('lock-uncertain', 'Cannot verify the previous MenuPilot process; its lock was not removed.');
      }
      unlinkSync(path);
    }
    const fd = openSync(path, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(owner)); fsyncSync(fd); } finally { closeSync(fd); }
  });
  return { owner, release: () => guarded(dir, () => {
    const current = readOwner(path);
    if (current?.instanceId !== owner.instanceId || current.pid !== owner.pid) return false;
    unlinkSync(path); return true;
  }) };
}
