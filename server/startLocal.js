import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openSync, writeFileSync, closeSync, fsyncSync, renameSync } from 'node:fs';
import { canonicalDataDir, acquireLock } from './lock.js';
import { createSqliteStorage } from './sqlite.js';
import { serveLocal } from './http.js';
import { ensureBuild } from './build.js';

export async function start() {
  process.umask(0o077);
  const value = process.env.MENUPILOT_PORT ?? '4710';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) throw new Error('MENUPILOT_PORT must be an integer from 1 to 65535.');
  const port = Number(value), dir = canonicalDataDir();
  const lock = acquireLock(dir, `http://127.0.0.1:${port}`);
  let storage, http, stopping = false;
  const abort = new AbortController();
  const onSignal = () => { stopping = true; abort.abort(); if (http) void close(); };
  let closing;
  function close() {
    return closing ??= (async () => {
      try { if (http) await http.close(); }
      finally {
        try { storage?.close(); }
        finally { lock.release(); process.off('SIGTERM', onSignal); process.off('SIGINT', onSignal); }
      }
    })();
  }
  process.on('SIGTERM', onSignal); process.on('SIGINT', onSignal);
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    await ensureBuild(root, abort.signal);
    if (stopping) { await close(); return; }
    storage = createSqliteStorage(join(dir, 'menupilot.db'));
    const cliToken = randomBytes(32).toString('hex');
    // Replace rather than truncate: a previously permissive token file cannot keep its mode.
    const temporary = join(dir, `token.${lock.owner.instanceId}`), fd = openSync(temporary, 'wx', 0o600);
    try { writeFileSync(fd, cliToken); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, join(dir, 'token'));
    http = await serveLocal({ storage, dataDir: dir, distDir: join(root, 'dist'), port, cliToken });
    if (stopping) { await close(); return; }
    console.log(`MenuPilot: ${http.address}/menupilot/\nData: ${dir}\nStop: Ctrl+C`);
  } catch (error) { await close(); if (!stopping) throw error; }
}
