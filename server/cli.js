#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { assertRuntime } from './runtime.js';
import { executeReadCommand, localDataPath, localDoctor, serializeCliError } from './cliRead.js';

const readCommands = new Set(['status', 'what-changed', 'dishes', 'dish', 'ingredients', 'ingredient', 'preps', 'simulate', 'history', 'journal', 'backups']);
const help = 'Usage: npm run menupilot -- <status|doctor|what-changed|dishes|dish|ingredients|ingredient|preps|simulate|history|journal|backups> [options]';
function jsonRequested(args) { return args.includes('--json'); }
function printJson(value, error = false) { (error ? console.error : console.log)(JSON.stringify(value)); }
function exitCode(code) { return ({ usage: 2, 'invalid-argument': 2, 'invalid-unit': 2, 'not-found': 4, ambiguous: 4, unauthorized: 5, unavailable: 3 })[code] ?? 1; }
function cliError(code, message) { return Object.assign(new Error(message), { code }); }
function portFromAddress(address) { const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(address ?? ''); return match ? Number(match[1]) : null; }
async function connection(dir) {
  let lock;
  try { lock = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')); }
  catch { throw cliError('unavailable', 'MenuPilot is unavailable. Run npm start, then try the command again.'); }
  const port = portFromAddress(lock.address);
  if (!port || port > 65535 || typeof lock.instanceId !== 'string') throw cliError('unavailable', 'MenuPilot is unavailable. Run npm start, then try the command again.');
  try {
    const response = await fetch(lock.address + '/menupilot-instance', { signal: AbortSignal.timeout(1500), redirect: 'error' });
    const instance = await response.json();
    if (!response.ok || instance.service !== 'MenuPilot' || instance.instanceId !== lock.instanceId) throw new Error();
  } catch { throw cliError('unavailable', 'MenuPilot is unavailable. Run npm start, then try the command again.'); }
  let token;
  try {
    const path = join(dir, 'token'); const mode = statSync(path).mode & 0o777;
    if (process.platform !== 'win32' && mode !== 0o600) throw cliError('unauthorized', 'The MenuPilot CLI token must have file permissions 0600. Restart MenuPilot to replace it safely.');
    token = readFileSync(path, 'utf8');
  } catch (error) { if (error.code === 'unauthorized') throw error; throw cliError('unauthorized', 'The MenuPilot CLI token is missing. Restart MenuPilot to create a private token.'); }
  async function api(route) {
    let response;
    try { response = await fetch(lock.address + '/api/' + route, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw cliError('unavailable', 'MenuPilot is unavailable. Run npm start, then try the command again.'); }
    let value; try { value = await response.json(); } catch { throw cliError('server-error', 'MenuPilot returned an invalid response.'); }
    if (response.status === 401) throw cliError('unauthorized', 'The MenuPilot CLI token was rejected. Restart MenuPilot, then try again.');
    if (!response.ok) throw cliError(value.code || 'server-error', value.message || 'MenuPilot could not complete the command.');
    return value;
  }
  return { api, address: lock.address };
}

async function confirm(message, yes) {
  if (yes) return;
  if (!process.stdin.isTTY) throw cliError('confirmation-required', 'Confirmation required. Review the backup ID, then repeat with --yes.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { if ((await rl.question(message + '\nType RESTORE to continue: ')) !== 'RESTORE') throw cliError('cancelled', 'Cancelled. Data is unchanged.'); }
  finally { rl.close(); }
}

function displayValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.length ? value.map(item => `- ${displayValue(item).replace(/\n/g, '\n  ')}`).join('\n') : '(none)';
  return Object.entries(value).map(([key, item]) => `${key}: ${displayValue(item)}`).join('\n');
}
function printHuman(result) {
  const { command, data, warnings = [] } = result;
  if (command === 'dishes' || command === 'preps' || command === 'ingredients') {
    for (const item of data) console.log(`${item.name}  [${item.id}]${item.currentPrice ? `  ${item.currentPrice.packPrice} excl. VAT` : ''}`);
  } else if (command === 'what-changed') {
    console.log(`What changed since ${data.since}`);
    for (const row of data.dishes) console.log(`${row.name}: ${row.comparisonCost ?? 'n/a'} → ${row.currentCost ?? 'n/a'} (${row.change ?? 'n/a'}); monthly impact ${row.monthlyImpact ?? '—'}${row.excludedReason ? `; excluded: ${row.excludedReason}` : ''}`);
    console.log(`Menu monthly impact: ${data.totalMonthlyImpact ?? '—'}`);
  } else if (command === 'simulate') {
    console.log(`${data.name}: recipe-based ingredient cost ${data.recipeBasedIngredientCost ?? 'cost unknown'}; contribution ${data.contribution ?? 'n/a'} (${data.contributionDelta ?? 'no change'}); monthly contribution ${data.monthlyContribution ?? '—'} (${data.monthlyContributionDelta ?? '—'})`);
  } else if (command === 'status') {
    console.log(`Mode: ${data.mode}\nData folder: ${data.dataDir}\nDocument: ${data.documentId ?? 'empty'}\nRevision: ${data.revision}\nLast backup: ${data.lastBackup ?? 'none'}\nLast external backup: ${data.lastExternalBackup ?? 'none'}`);
  } else if (command === 'doctor') {
    if (data.backupStatus) console.log(JSON.stringify(data.backupStatus, null, 2));
    for (const check of data.checks) console.log(`${check.ok ? 'OK' : 'CHECK'} ${check.name}: ${check.detail}${!check.ok && check.advice ? `\n  Advice: ${check.advice}` : ''}`);
  } else if (command === 'dish' || command === 'ingredient') console.log(displayValue(data));
  else console.log(displayValue(data));
  for (const warning of warnings) console.log(`Warning: ${warning}`);
}

async function run(args) {
  const wantJson = jsonRequested(args);
  try {
    if (args[0] !== 'doctor' || args[1] === '--recover-from-backup') assertRuntime();
    process.umask(0o077);
    const dir = localDataPath();
    const command = args[0];
    if (command === 'doctor' && args[1] === '--recover-from-backup' && args[2] && (args.length === 3 || (args.length === 4 && args[3] === '--yes'))) {
      await confirm(`Emergency recovery from ${args[2]}. Stop the server first. Original database files will be preserved beside the recovered database.`, args[3] === '--yes');
      const { recoverFromBackup } = await import('./recovery.js');
      const result = await recoverFromBackup(dir, args[2]);
      console.log(`Recovered. Original files and report: ${result.reportPath}\nRun npm start. Emergency recovery uses a new dataset identity; changes after the backup are not recovered.`);
      return;
    }
    if (readCommands.has(command)) {
      const { api } = await connection(dir);
      const result = await executeReadCommand(command, args.slice(1), api);
      if (wantJson) printJson(result); else printHuman(result);
      return;
    }
    if (command === 'doctor') {
      if (args.length > 2 || (args[1] && args[1] !== '--json')) throw cliError('usage', help);
      let backupsStatus = null, version = { documentId: null, revision: 0 }, connected = false;
      try { const { api } = await connection(dir); connected = true;
        [backupsStatus, version] = await Promise.all([api('backups/status'), api('version')]);
      } catch (error) { if (error.code !== 'unavailable') throw error; }
      const data = await localDoctor(dir, connected, backupsStatus);
      data.backupStatus = backupsStatus;
      if (!connected) data.warnings.push('MenuPilot is not running. Start it with npm start to check live document and backup status.');
      const result = { apiVersion: 1, command: 'doctor', documentId: version.documentId, revision: version.revision, data, warnings: data.warnings };
      if (wantJson) printJson(result); else printHuman(result);
      return;
    }
    if (command === 'open-url' || command === 'backup') {
      try { await runExistingServerCommand(args, dir); } catch (error) {
        if (error.code === 'unavailable') error.code = 'command-failed';
        throw error;
      }
      return;
    }
    throw cliError('usage', help);
  } catch (error) {
    if (wantJson) printJson(serializeCliError(error), true);
    else console.error(error.message || 'MenuPilot could not complete the command.');
    process.exitCode = exitCode(error.code);
  }
}

async function runExistingServerCommand(args, dir) {
  const open = args[0] === 'open-url' && (args.length === 1 || (args.length === 2 && args[1] === '--revoke-sessions'));
  const list = args[0] === 'backup' && args[1] === 'list' && args.length === 2;
  const verify = args[0] === 'backup' && args[1] === 'verify' && args.length === 3;
  const restore = args[0] === 'backup' && args[1] === 'restore' && (args.length === 3 || (args.length === 4 && args[3] === '--yes'));
  if (!open && !list && !verify && !restore) throw cliError('usage', help);
  const { api, address } = await connection(dir);
  if (open) {
    const result = await fetch(address + '/api/open-url', { method: 'POST', headers: { Authorization: `Bearer ${readFileSync(join(dir, 'token'), 'utf8')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ revokeSessions: args[1] === '--revoke-sessions' }) });
    const { url } = await result.json(); console.log(url);
  } else if (list) {
    const entries = await api('backups'); for (const entry of entries) console.log(entry.invalid ? `${entry.id} INVALID${entry.quarantined ? ' — quarantined' : ''} — not a restore point` : `${entry.id}  ${entry.createdAt}  revision ${entry.revision}  ${entry.documentId ?? '(empty)'}  DB v${entry.dbVersion}  ${entry.reason}`);
    if (!entries.length) console.log('No backups yet. A backup is created within five minutes of a change, and on normal shutdown.');
  } else if (verify) {
    const result = await fetch(address + '/api/backups/verify', { method: 'POST', headers: { Authorization: `Bearer ${readFileSync(join(dir, 'token'), 'utf8')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: args[2] }) });
    const checked = await result.json(); if (!result.ok) throw cliError(checked.code, checked.message);
    console.log(`Verified by restoring to a temporary database: ${checked.id}, revision ${checked.revision}.`);
  } else {
    const verification = await fetch(address + '/api/backups/verify', { method: 'POST', headers: { Authorization: `Bearer ${readFileSync(join(dir, 'token'), 'utf8')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: args[2] }) });
    const checked = await verification.json(); if (!verification.ok) throw cliError(checked.code, checked.message);
    const current = await api('version'); await confirm(`Replace current revision ${current.revision} with the document from backup ${checked.id} (revision ${checked.revision})? A verified copy of the current data will be created first.`, args[3] === '--yes');
    const response = await fetch(address + '/api/backups/restore', { method: 'POST', headers: { Authorization: `Bearer ${readFileSync(join(dir, 'token'), 'utf8')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: args[2], expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: crypto.randomUUID() }) });
    const result = await response.json(); if (!response.ok) throw cliError(result.code, result.message); if (result.conflict) throw cliError('conflict', 'Data changed while you were confirming. Nothing was restored.');
    console.log(`Restored as new revision ${result.revision}. Operation receipt: ${result.receipt.opId}.`);
  }
}

await run(process.argv.slice(2));
