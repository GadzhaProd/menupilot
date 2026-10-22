import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { privateFile } from './session.js';
import { canonicalDataDir, acquireLock } from './lock.js';
import { openLocalStorage } from './backups.js';
import { dataLocationWarning } from './recovery.js';
import { serveLocal } from './http.js';
import { ensureBuild } from './build.js';

export async function start() {
  process.umask(0o077);
  const value = process.env.MENUPILOT_PORT ?? '4710';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('MENUPILOT_PORT must be an integer from 1 to 65535.');
  const port = Number(value), dir = canonicalDataDir();
  const lock = await acquireLock(dir, `http://127.0.0.1:${port}`);
  let storage, http, stopping = false, stopWork, finalizing;
  const abort = new AbortController();
  const shutdownFailure = error => `Data is saved in the database; the backup was not created — it will be made on the next start (reason: ${String(error?.message ?? error).replace(/\s+/g, ' ').trim() || 'unknown'})`;
  function requestStop() {
    stopping = true;
    http?.stopAccepting();
    return stopWork ??= (async () => {
      try { await storage?.close(); return { backupCreated: true }; }
      catch (error) { return { backupCreated: false, code: 'shutdown-backup-failed', message: shutdownFailure(error) }; }
    })();
  }
  function finishStop(result, report) {
    return finalizing ??= (async () => {
      try { await http?.close(); }
      finally {
        try { await lock.release(); }
        finally { process.off('SIGTERM', onSignal); process.off('SIGINT', onSignal); }
      }
      if (!result.backupCreated) {
        process.exitCode = 1;
        if (report) console.error(result.message);
      } else if (report) console.log(`MenuPilot stopped. Your data is in ${dir}`);
    })();
  }
  async function closeOnStartupFailure() {
    try { await http?.close(); }
    finally { try { await storage?.close(); } finally { await lock.release(); process.off('SIGTERM', onSignal); process.off('SIGINT', onSignal); } }
  }
  const onSignal = () => {
    abort.abort();
    void requestStop().then(result => finishStop(result, true)).catch(error => { console.error(error.message); process.exitCode = 1; });
  };
  process.on('SIGTERM', onSignal); process.on('SIGINT', onSignal);
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    await ensureBuild(root, abort.signal);
    if (stopping) { await finishStop(await requestStop(), true); return; }
    const warning = dataLocationWarning(dir);
    if (warning) console.warn(warning);
    storage = await openLocalStorage(dir);
    const cliToken = randomBytes(32).toString('hex');
    privateFile(dir, 'token', cliToken);
    http = await serveLocal({ storage, dataDir: dir, distDir: join(root, 'dist'), port, cliToken, instanceId: lock.owner.instanceId, requestStop, finishStop: result => finishStop(result, false) });
    if (stopping) { await finishStop(await requestStop(), true); return; }
    console.log(`MenuPilot: ${http.openUrl}\nData: ${dir}\nStop: Ctrl+C`);
  } catch (error) { await closeOnStartupFailure(); if (!stopping) throw error; }
}
