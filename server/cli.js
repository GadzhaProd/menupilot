import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { assertRuntime } from './runtime.js';

const usage = 'Usage: npm run menupilot -- open-url [--revoke-sessions] | backup list | backup verify <id> | backup restore <id> [--yes] | doctor --recover-from-backup <id> [--yes]';
async function confirm(message, yes) {
  if (yes) return;
  if (!process.stdin.isTTY) throw new Error('Confirmation required. Review the backup ID, then repeat with --yes.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { if ((await rl.question(message + '\nType RESTORE to continue: ')) !== 'RESTORE') throw new Error('Cancelled. Data is unchanged.'); }
  finally { rl.close(); }
}
try {
  assertRuntime();
  process.umask(0o077);
  const args = process.argv.slice(2);
  const { canonicalDataDir } = await import('./lock.js');
  const dir = canonicalDataDir();
  if (args[0] === 'doctor' && args[1] === '--recover-from-backup' && args[2] && (args.length === 3 || (args.length === 4 && args[3] === '--yes'))) {
    await confirm(`Emergency recovery from ${args[2]}. Stop the server first. Original database files will be preserved beside the recovered database.`, args[3] === '--yes');
    const { recoverFromBackup } = await import('./recovery.js');
    const result = await recoverFromBackup(dir, args[2]);
    console.log(`Recovered. Original files and report: ${result.reportPath}\nRun npm start. Emergency recovery uses a new dataset identity; changes after the backup are not recovered.`);
  } else {
    const open = args[0] === 'open-url' && (args.length === 1 || (args.length === 2 && args[1] === '--revoke-sessions'));
    const list = args[0] === 'backup' && args[1] === 'list' && args.length === 2;
    const verify = args[0] === 'backup' && args[1] === 'verify' && args.length === 3;
    const restore = args[0] === 'backup' && args[1] === 'restore' && (args.length === 3 || (args.length === 4 && args[3] === '--yes'));
    if (!open && !list && !verify && !restore) throw new Error(usage);
    let owner, token;
    try {
      owner = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8'));
      if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(owner.address)) throw new Error();
      const response = await fetch(owner.address + '/menupilot-instance', { signal: AbortSignal.timeout(1500), redirect: 'error' });
      const instance = await response.json();
      if (!response.ok || instance.service !== 'MenuPilot' || instance.instanceId !== owner.instanceId) throw new Error();
      token = readFileSync(join(dir, 'token'), 'utf8');
    } catch { throw new Error('MenuPilot is unavailable. Run npm start, then try the command again.'); }
    async function api(route, body) {
      let response;
      try { response = await fetch(owner.address + '/api/' + route, {
        method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
        ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(120000), redirect: 'error',
      }); } catch { throw new Error('The server response was lost. The operation may have completed. Run backup list and inspect the current data before trying another restore.'); }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'MenuPilot could not complete the command.');
      return result;
    }
    if (open) {
      const { url } = await api('open-url', { revokeSessions: args[1] === '--revoke-sessions' });
      if (typeof url !== 'string' || !url.startsWith(owner.address + '/menupilot/#k=')) throw new Error('Invalid server address.');
      console.log(url);
    } else if (list) {
      const entries = await api('backups');
      for (const entry of entries) console.log(entry.invalid ? `${entry.id} INVALID — verify failed metadata` : `${entry.id}  ${entry.createdAt}  revision ${entry.revision}  ${entry.documentId ?? '(empty)'}  DB v${entry.dbVersion}  ${entry.reason}`);
      if (!entries.length) console.log('No backups yet. A backup is created within five minutes of a change, and on normal shutdown.');
    } else if (verify) {
      const checked = await api('backups/verify', { id: args[2] });
      console.log(`Verified by restoring to a temporary database: ${checked.id}, revision ${checked.revision}.`);
    } else {
      const checked = await api('backups/verify', { id: args[2] });
      const current = await api('version');
      await confirm(`Replace current revision ${current.revision} with the document from backup ${checked.id} (revision ${checked.revision})? A verified copy of the current data will be created first.`, args[3] === '--yes');
      const result = await api('backups/restore', { id: args[2], expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: randomUUID() });
      if (result.conflict) throw new Error('Data changed while you were confirming. Nothing was restored. Review the current data and try again.');
      console.log(`Restored as new revision ${result.revision}. Operation receipt: ${result.receipt.opId}.`);
    }
  }
} catch (error) {
  console.error(error.message || 'MenuPilot could not complete the command.');
  process.exitCode = 1;
}
