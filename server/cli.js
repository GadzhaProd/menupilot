#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { assertRuntime } from './runtime.js';
import { executeReadCommand, localDataPath, localDoctor, serializeCliError } from './cliRead.js';
import { executePlanCommand, printPlan } from './cliPlans.js';
import { hasValidOpenResult } from './cliSecurity.js';

const readCommands = new Set(['status', 'what-changed', 'dishes', 'dish', 'ingredients', 'ingredient', 'preps', 'simulate', 'history', 'journal', 'backups']);
const help = 'Usage: npm run menupilot -- <status|doctor|what-changed|dishes|dish|ingredients|ingredient|preps|simulate|history|journal|backups|stop|propose|plans|plan> [options]';
function jsonRequested(args) { return args.includes('--json'); }
function printJson(value, error = false) { (error ? console.error : console.log)(JSON.stringify(value)); }
function exitCode(code) { return ({ usage: 2, 'invalid-argument': 2, 'invalid-unit': 2, 'price-limit': 2, 'not-found': 4, ambiguous: 4, unauthorized: 5, unavailable: 3 })[code] ?? 1; }
function cliError(code, message) { return Object.assign(new Error(message), { code }); }
function portFromAddress(address) { const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(address ?? ''); return match ? Number(match[1]) : null; }
export async function connection(dir) {
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
  async function api(route, { method = 'GET', body, timeoutMs = method === 'GET' ? 15000 : 30000 } = {}) {
    let response;
    const headers = { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) };
    try { response = await fetch(lock.address + '/api/' + route, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' }); }
    catch (error) {
      if (method !== 'GET') throw cliError('response-lost', 'Response lost; the operation may have completed. Check MenuPilot status before retrying.');
      throw cliError('unavailable', 'MenuPilot is unavailable. Run npm start, then try the command again.');
    }
    let value; try { value = await response.json(); } catch { throw cliError('server-error', 'MenuPilot returned an invalid response.'); }
    if (response.status === 401) throw cliError('unauthorized', 'The MenuPilot CLI token was rejected. Restart MenuPilot, then try again.');
    if (!response.ok) throw Object.assign(cliError(value.code || 'server-error', value.message || 'MenuPilot could not complete the command.'), { candidates: value.candidates });
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
  if (typeof value === 'object' && !Array.isArray(value) && typeof value.display === 'string') return value.display;
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.length ? value.map(item => `- ${displayValue(item).replace(/\n/g, '\n  ')}`).join('\n') : '(none)';
  return Object.entries(value).map(([key, item]) => `${key}: ${displayValue(item)}`).join('\n');
}
function printHuman(result, locale = 'en') {
  const { command, data, warnings = [] } = result;
  if (command === 'dishes' || command === 'preps' || command === 'ingredients') {
    for (const item of data) console.log(`${item.name}  [${item.id}]${item.currentPrice ? `  ${displayValue(item.currentPrice.packPrice)} excl. VAT` : ''}`);
  } else if (command === 'what-changed') {
    const nl = locale === 'nl';
    console.log(`${nl ? 'Wat is er veranderd sinds' : 'What changed since'} ${data.since}`);
    for (const row of data.dishes) console.log(`${row.name}: ${displayValue(row.comparisonCost) || 'n/a'} → ${displayValue(row.currentCost) || 'n/a'} (${displayValue(row.change) || 'n/a'}); ${nl ? 'maandelijkse verandering' : 'monthly impact'} ${displayValue(row.monthlyImpact)}${row.excludedReason ? `; ${nl ? 'uitgesloten' : 'excluded'}: ${nl && row.excludedReason === 'no-volume' ? 'zonder maandvolume' : row.excludedReason}` : ''}`);
    console.log(`${nl ? 'Verandering in maandelijkse bijdrage van het menu' : 'Menu monthly impact'}: ${displayValue(data.totalMonthlyImpact)}`);
    console.log(`${nl ? 'Uitgesloten' : 'Excluded'}: ${data.excludedWithoutVolume} ${nl ? 'zonder maandvolume' : 'without volume'}; ${data.excludedWithVolume} ${nl ? 'met onbekende/onvolledige kosten' : 'with unknown/incomplete cost'}.`);
  } else if (command === 'simulate') {
    console.log(`${data.name}: recipe-based ingredient cost ${displayValue(data.recipeBasedIngredientCost) ?? 'cost unknown'}; contribution ${displayValue(data.contribution)} (${displayValue(data.contributionDelta) ?? 'no change'}); monthly contribution ${displayValue(data.monthlyContribution)} (${displayValue(data.monthlyContributionDelta)})`);
  } else if (command === 'status') {
    console.log(`Mode: ${data.mode}\nData folder: ${data.dataDir}\nDocument: ${result.documentId ?? 'empty'}\nRevision: ${result.revision}\nLast backup: ${data.lastBackup ?? 'none'}\nLast external backup: ${data.lastExternalBackup ?? 'none'}`);
  } else if (command === 'doctor') {
    for (const check of data.checks) console.log(`${check.ok ? 'OK' : 'CHECK'} ${check.name}: ${check.detail}${!check.ok && check.advice ? `\n  Advice: ${check.advice}` : ''}`);
  } else if (command === 'backups') {
    for (const entry of data.entries ?? []) console.log(entry.invalid ? `${entry.id} INVALID${entry.quarantined ? ' — quarantined' : ''} — not a restore point` : `${entry.id}  ${entry.createdAt}  revision ${entry.revision}  DB v${entry.dbVersion}  ${entry.reason}`);
    if (!(data.entries ?? []).length) console.log('No backups yet.');
  } else if (command === 'dish') {
    console.log(`${data.name} [${data.id}]`);
    console.log(`Menu price: ${displayValue(data.menuPriceInclVat)} ${data.menuPriceLabel}`);
    console.log(`Recipe-based ingredient cost: ${data.recipeBasedIngredientCost ? displayValue(data.recipeBasedIngredientCost) : 'cost unknown'} excl. VAT`);
    console.log(`Contribution: ${displayValue(data.contribution)} excl. VAT`);
    console.log(`Portions: ${data.portions}\nMonthly volume: ${data.monthlyVolume ?? '—'}`);
  } else if (command === 'ingredient') console.log(displayValue(data));
  else console.log(displayValue(data));
  for (const warning of warnings) console.log(`Warning: ${typeof warning === 'string' ? warning : warning.message}`);
}

async function run(args) {
  const wantJson = jsonRequested(args);
  try {
    if (args[0] !== 'doctor' || args[1] === '--recover-from-backup') assertRuntime();
    process.umask(0o077);
    const dir = localDataPath();
    const command = args[0];
    if (!command || command === 'help' || command === '--help' || command === '-h') { console.log(help); return; }
    if (command === 'doctor' && args[1] === '--recover-from-backup' && args[2] && (args.length === 3 || (args.length === 4 && args[3] === '--yes'))) {
      await confirm(`Emergency recovery from ${args[2]}. Stop the server first. Original database files will be preserved beside the recovered database.`, args[3] === '--yes');
      const { recoverFromBackup } = await import('./recovery.js');
      const result = await recoverFromBackup(dir, args[2]);
      console.log(`Recovered. Original files and report: ${result.reportPath}\nRun npm start. Emergency recovery uses a new dataset identity; changes after the backup are not recovered.`);
      return;
    }
    if (['propose', 'plans', 'plan'].includes(command)) {
      const { api } = await connection(dir);
      const result = await executePlanCommand(command, args.slice(1), api);
      if (wantJson) { const { locale, ...output } = result; printJson(output); } else printPlan(result);
      return;
    }
    if (readCommands.has(command)) {
      const { api } = await connection(dir);
      const result = await executeReadCommand(command, args.slice(1), api);
      const localeIndex = args.indexOf('--locale');
      const locale = localeIndex >= 0 ? args[localeIndex + 1] : 'en';
      if (wantJson) printJson(result); else printHuman(result, locale);
      return;
    }
    if (command === 'doctor') {
      if (args.length > 2 || (args[1] && args[1] !== '--json')) throw cliError('usage', help);
      let backupsStatus = null, version = { documentId: null, revision: 0 }, connected = false, tokenIssue = null;
      try { const { api } = await connection(dir); connected = true;
        [backupsStatus, version] = await Promise.all([api('backups/status'), api('version')]);
      } catch (error) { if (error.code === 'unauthorized') tokenIssue = error.message; else if (error.code !== 'unavailable') throw error; }
      const data = await localDoctor(dir, connected, backupsStatus, tokenIssue);
      if (!connected && !tokenIssue) data.warnings.push({ code: 'server-unavailable', message: 'MenuPilot is not running. Start it with npm start to check live document and backup status.' });
      const result = { apiVersion: 1, command: 'doctor', documentId: version.documentId, revision: version.revision, data, warnings: data.warnings };
      if (wantJson) printJson(result); else printHuman(result);
      if (data.checks.some(check => !check.ok)) process.exitCode = 1;
      return;
    }
    if (command === 'open-url' || command === 'backup' || command === 'stop') {
      await runExistingServerCommand(args.filter(arg => arg !== '--json'), dir, wantJson);
      return;
    }
    throw cliError('usage', help);
  } catch (error) {
    if (wantJson) printJson(serializeCliError(error), true);
    else {
      console.error(error.message || 'MenuPilot could not complete the command.');
      for (const candidate of error.candidates ?? []) console.error(`- ${candidate.id}: ${candidate.name}${candidate.unit ? ` (${candidate.unit})` : ''}${candidate.packaging ? `; pack ${displayValue(candidate.packaging.packPrice)} ${candidate.packaging.packPriceLabel}` : ''}`);
    }
    process.exitCode = exitCode(error.code);
  }
}

async function runExistingServerCommand(args, dir, wantJson = false) {
  const open = args[0] === 'open-url' && (args.length === 1 || (args.length === 2 && args[1] === '--revoke-sessions'));
  const list = args[0] === 'backup' && args[1] === 'list' && args.length === 2;
  const verify = args[0] === 'backup' && args[1] === 'verify' && args.length === 3;
  const restore = args[0] === 'backup' && args[1] === 'restore' && (args.length === 3 || (args.length === 4 && args[3] === '--yes'));
  const stop = args[0] === 'stop' && args.length === 1;
  if (!open && !list && !verify && !restore && !stop) throw cliError('usage', help);
  const { api } = await connection(dir);
  if (stop) {
    const version = await api('version');
    const result = await api('stop', { method: 'POST', body: {}, timeoutMs: 120000 });
    if (result.stopped !== true || typeof result.backupCreated !== 'boolean') throw cliError('server-error', 'MenuPilot returned an invalid stop response.');
    const warnings = result.backupCreated ? [] : [{ code: result.code ?? 'shutdown-backup-failed', message: result.message ?? 'Shutdown backup failed.' }];
    if (wantJson) printJson({ apiVersion: 1, command: 'stop', documentId: version.documentId, revision: version.revision, data: { stopped: result.backupCreated, dataDir: dir }, warnings });
    else console.log(result.backupCreated ? `MenuPilot stopped. Your data is in ${dir}` : warnings[0].message);
    if (!result.backupCreated) process.exitCode = 1;
  } else if (open) {
    const result = await api('open-url', { method: 'POST', body: { revokeSessions: args[1] === '--revoke-sessions' } });
    if (!hasValidOpenResult(result)) throw cliError('server-error', 'MenuPilot returned an invalid browser-open response.');
    console.log(result.opened ? 'MenuPilot opened in your browser.' : 'Could not open the browser. Open the address from the terminal window running npm start, or restart npm start.');
  } else if (list) {
    const entries = await api('backups'); for (const entry of entries) console.log(entry.invalid ? `${entry.id} INVALID${entry.quarantined ? ' — quarantined' : ''} — not a restore point` : `${entry.id}  ${entry.createdAt}  revision ${entry.revision}  ${entry.documentId ?? '(empty)'}  DB v${entry.dbVersion}  ${entry.reason}`);
    if (!entries.length) console.log('No backups yet. A backup is created within five minutes of a change, and on normal shutdown.');
  } else if (verify) {
    const checked = await api('backups/verify', { method: 'POST', body: { id: args[2] } });
    console.log(`Verified by restoring to a temporary database: ${checked.id}, revision ${checked.revision}.`);
  } else {
    const checked = await api('backups/verify', { method: 'POST', body: { id: args[2] } });
    const current = await api('version'); await confirm(`Replace current revision ${current.revision} with the document from backup ${checked.id} (revision ${checked.revision})? A verified copy of the current data will be created first.`, args[3] === '--yes');
    const result = await api('backups/restore', { method: 'POST', body: { id: args[2], expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: crypto.randomUUID() } }); if (result.conflict) throw cliError('conflict', 'Data changed while you were confirming. Nothing was restored.');
    console.log(`Restored as new revision ${result.revision}. Operation receipt: ${result.receipt.opId}.`);
  }
}

await run(process.argv.slice(2));
