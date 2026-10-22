import { accessSync, constants, existsSync, readFileSync, statfsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { connect } from 'node:net';
import { createBaselineSnapshot, simulate } from '../src/calc/simulate.js';
import { recipeCost, metrics } from '../src/calc/costing.js';
import { dashboardData } from '../src/calc/dashboard.js';
import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale, normalizeLocale, parseMoneyToCents } from '../src/calc/money.js';
import { parseQuantityToMilli } from '../src/calc/units.js';
import { dataLocationWarning } from './recovery.js';

export const API_VERSION = 1;
const isMoney = key => /(?:Cents|Micro)$/.test(key);
const money = (value, locale = 'en', micro = false) => value === null || value === undefined
  ? null : { [micro ? 'micro' : 'cents']: String(value), display: micro ? formatEURFromMicroLocale(value, locale) : formatEURFromCentsLocale(value, locale) };
const percent = (value, locale = 'en') => value === null || value === undefined ? null : formatPercentTenthsLocale(value, locale);
const localDataPath = () => resolve(process.env.MENUPILOT_DATA_DIR || (process.platform === 'darwin'
  ? join(homedir(), 'Library/Application Support/MenuPilot')
  : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'menupilot')));

function asRecord(value, locale = 'en') {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(item => asRecord(item, locale));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const numericAmount = typeof item === 'bigint' || (typeof item === 'number' && isMoney(key));
      output[key] = numericAmount ? String(item) : asRecord(item, locale);
      if (numericAmount && /Cents$/.test(key)) output[`${key.slice(0, -5)}Display`] = formatEURFromCentsLocale(item, locale);
      if (numericAmount && /Micro$/.test(key)) output[`${key.slice(0, -5)}Display`] = formatEURFromMicroLocale(item, locale);
      if (numericAmount && /(?:Pct|Tenths)$/.test(key)) output[`${key}Display`] = formatPercentTenthsLocale(item, locale);
    }
    return output;
  }
  return value;
}

function readArgs(args) {
  const flags = { json: false, locale: 'en' }, positional = [];
  const values = new Map();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') flags.json = true;
    else if (arg === '--locale') { if (!args[i + 1]) throw cliError('usage', 'Provide --locale en or nl.'); flags.locale = args[++i]; }
    else if (arg.startsWith('--')) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw cliError('usage', `Missing value for ${arg}.`);
      const optionValue = args[++i];
      if (values.has(arg) && !['--qty', '--ingredient-price'].includes(arg)) throw cliError('usage', `${arg} can be used only once.`);
      if (['--qty', '--ingredient-price'].includes(arg)) values.set(arg, [...(values.get(arg) ?? []), optionValue]);
      else values.set(arg, optionValue);
    } else positional.push(arg);
  }
  if (!['en', 'nl'].includes(flags.locale)) throw cliError('usage', 'Locale must be en or nl.');
  return { flags, positional, values };
}
function cliError(code, message, candidates) { return Object.assign(new Error(message), { code, candidates }); }
function exactCandidates(entries, locale = 'en') { return entries.map(entry => ({ id: entry.id, name: entry.name, unit: entry.unit ?? entry.outputUnit ?? null,
  packaging: entry.prices?.length ? { packPrice: money(entry.prices.at(-1).packPriceCents, locale), packPriceLabel: 'excl. VAT', packSizeMilli: entry.prices.at(-1).packSizeMilli } : null })); }
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = old; }
  }
  return row[b.length];
}
function normalized(value) { return String(value).trim().normalize('NFC').toLocaleLowerCase('en'); }
function resolveOne(entries, value, type, locale = 'en') {
  const id = entries.find(entry => normalized(entry.id) === normalized(value));
  if (id) return id;
  const matches = entries.filter(entry => normalized(entry.name) === normalized(value));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw cliError('ambiguous', `More than one ${type} has the exact name “${value}”. Choose an ID.`, exactCandidates(matches, locale));
  const needle = normalized(value);
  const suggestions = entries.map(entry => ({ entry, d: distance(normalized(entry.name), needle), contains: normalized(entry.name).includes(needle) || needle.includes(normalized(entry.name)) }))
    .filter(candidate => candidate.contains || candidate.d <= Math.max(2, Math.floor(needle.length / 4)))
    .sort((a, b) => Number(b.contains) - Number(a.contains) || a.d - b.d).slice(0, 3).map(candidate => candidate.entry);
  throw cliError('not-found', `No ${type} matches “${value}”.${suggestions.length ? ` Perhaps you meant: ${suggestions.map(item => `${item.name} (${item.id})`).join(', ')}.` : ''}`, exactCandidates(suggestions, locale));
}

export function dashboardDateDaysAgo(days) { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setTime(date.getTime() - days * 86400000); return date.toISOString().slice(0, 10); }
export function dateFor(since) {
  if (!since) since = '30d';
  if (/^\d+d$/.test(since)) { const days = Number(since.slice(0, -1)); if (!Number.isSafeInteger(days) || days < 1) throw cliError('usage', '--since day range must be a positive integer.'); since = dashboardDateDaysAgo(days); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(`${since}T00:00:00.000Z`)) || new Date(`${since}T00:00:00.000Z`).toISOString().slice(0, 10) !== since) {
    throw cliError('usage', '--since must be Nd or a valid YYYY-MM-DD date.');
  }
  if (since > new Date().toISOString().slice(0, 10)) throw cliError('invalid-argument', '--since cannot be in the future.');
  return `${since}T23:59:59.999Z`;
}

function dashboardOutput(doc, asOf, locale) {
  const result = dashboardData(doc, asOf);
  const reason = row => row.monthlyVolume === null ? 'no-volume' : row.monthlyImpactCents === null ? row.status : null;
  const dishes = result.dishes.map(row => ({ id: row.id, name: row.name,
    comparisonCost: money(row.comparisonCostMicro, locale, true), currentCost: money(row.currentCostMicro, locale, true),
    change: money(row.costDeltaCents, locale), monthlyVolume: row.monthlyVolume,
    monthlyImpact: money(row.monthlyImpactCents, locale), status: row.status, excludedReason: reason(row) }));
  return { since: asOf.slice(0, 10), dishes, totalMonthlyImpact: money(result.totalMonthlyImpactCents, locale),
    excluded: dishes.filter(row => row.excludedReason !== null).map(({ id, name, excludedReason }) => ({ id, name, reason: excludedReason })),
    excludedWithoutVolume: result.excludedWithoutVolume, excludedWithVolume: result.excludedWithVolume,
    gotMoreExpensive: result.gotMoreExpensive,
    averageFoodCost: percent(result.averageFoodCostTenthsPct, locale) };
}

function parseOptions(values, name) { const raw = values.get(name); return raw === undefined ? undefined : raw; }
function parseNonNegativeInteger(raw, name) {
  if (!/^\d+$/.test(raw)) throw cliError('invalid-argument', `${name} must be a whole number.`);
  const value = Number(raw); if (!Number.isSafeInteger(value)) throw cliError('invalid-argument', `${name} is outside the safe integer range.`); return value;
}
function unitPackaging(ingredient, locale) {
  const price = ingredient.prices.at(-1);
  if (!price) return null;
  return { packPrice: money(price.packPriceCents, locale), packPriceUnit: 'excl. VAT', packSizeMilli: price.packSizeMilli, unit: ingredient.unit,
    recordedAt: price.recordedAt, sequence: price.seq };
}

function evaluateSimulation(doc, dishToken, values, locale) {
  const dish = resolveOne(doc.recipes.filter(r => r.kind === 'dish'), dishToken, 'dish', locale);
  const takenAt = new Date().toISOString();
  const baseline = createBaselineSnapshot(doc, dish.id, takenAt);
  const overrides = { ingredientPriceCents: {}, lineQtyMilli: {} };
  const menuPrice = parseOptions(values, '--menu-price');
  if (menuPrice !== undefined) {
    try { overrides.menuPriceInclVatCents = parseMoneyToCents(menuPrice); }
    catch (error) { throw cliError('invalid-argument', error.message); }
  }
  const volume = parseOptions(values, '--volume');
  if (volume !== undefined) overrides.monthlyVolume = parseNonNegativeInteger(volume, '--volume');
  const rawPrices = parseOptions(values, '--ingredient-price') ?? [];
  for (const rawPrice of rawPrices) {
    const split = rawPrice.indexOf('='); if (split < 1) throw cliError('invalid-argument', 'Use --ingredient-price <ingredient>=<pack-price>.');
    const ingredient = resolveOne(baseline.ingredients, rawPrice.slice(0, split), 'ingredient', locale);
    try { overrides.ingredientPriceCents[ingredient.id] = parseMoneyToCents(rawPrice.slice(split + 1)); }
    catch (error) { throw cliError('invalid-argument', error.message); }
  }
  const rawQtys = parseOptions(values, '--qty') ?? [];
  for (const rawQty of rawQtys) {
    const split = rawQty.indexOf('='); if (split < 1) throw cliError('invalid-argument', 'Use --qty <lineId|ingredient>=<quantity unit>.');
    const ref = rawQty.slice(0, split), quantityText = rawQty.slice(split + 1).trim();
    const match = /^(\d+(?:[.,]\d+)?)\s+(kg|g|l|ml|pc)$/i.exec(quantityText);
    if (!match) throw cliError('invalid-unit', 'Quantity must include a supported unit: kg, g, l, ml or pc.');
    const line = dish.lines.map(line => ({ line, target: line.ref.kind === 'ingredient'
      ? baseline.ingredients.find(i => i.id === line.ref.id) : baseline.recipes.find(r => r.id === line.ref.id) }))
      .filter(({ line, target }) => line.id === ref || target?.id === ref || target?.name.toLowerCase() === ref.toLowerCase());
    if (line.length !== 1) throw cliError(line.length ? 'ambiguous' : 'not-found', line.length ? `More than one dish line matches “${ref}”. Use a line ID.` : `Ingredient not used in dish: “${ref}”.`, line.map(({ line: l, target }) => ({ id: l.id, name: target?.name,
      unit: target?.unit ?? target?.outputUnit, packaging: target?.prices?.length ? { packPrice: money(target.prices.at(-1).packPriceCents, locale), packPriceLabel: 'excl. VAT', packSizeMilli: target.prices.at(-1).packSizeMilli } : null })));
    let entered;
    try { entered = parseQuantityToMilli(match[1], match[2]); }
    catch (error) { throw cliError('invalid-unit', error.message); }
    const expectedUnit = line[0].target.unit ?? line[0].target.outputUnit;
    if (entered.unit !== expectedUnit) throw cliError('invalid-unit', `That line uses ${expectedUnit}; the supplied ${match[2]} is incompatible.`);
    overrides.lineQtyMilli[line[0].line.id] = entered.quantityMilli;
  }
  const result = simulate(baseline, overrides);
  const base = simulate(baseline, {});
  const d = (a, b) => a === null || b === null ? null : a - b;
  const sign = amount => amount === null ? null : { cents: String(amount), display: `${amount > 0n ? '+' : ''}${money(amount, locale).display}` };
  return { id: dish.id, name: dish.name, status: result.status, menuPriceInclVat: money(result.menuPriceInclVatCents, locale),
    menuPriceLabel: 'incl. VAT', recipeBasedIngredientCost: money(result.ingredientCostCents, locale),
    contribution: money(result.contributionCents, locale), contributionDelta: sign(d(result.contributionCents, base.contributionCents)),
    monthlyVolume: result.monthlyVolume, monthlyContribution: money(result.monthlyContributionCents, locale),
    monthlyContributionDelta: sign(d(result.monthlyContributionCents, base.monthlyContributionCents)),
    foodCost: percent(result.foodCostPct, locale), contributionMargin: percent(result.marginPct, locale) };
}

export function portState(port) {
  return new Promise(resolveState => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(400);
    socket.once('connect', () => { socket.destroy(); resolveState(true); });
    socket.once('error', () => resolveState(false)); socket.once('timeout', () => { socket.destroy(); resolveState(false); });
  });
}
export function isSupportedNode(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return (major === 24 && minor >= 15) || (major === 25 && (minor > 8 || (minor === 8 && patch >= 1)));
}
async function localDoctor(dir, apiAvailable, backupsStatus, tokenIssue = null) {
  const checks = [], warnings = [];
  const add = (name, ok, detail, advice = null) => { checks.push({ name, ok, detail, ...(!ok && advice ? { advice } : {}) }); if (!ok && advice) warnings.push({ code: name, message: advice }); };
  add('node', isSupportedNode(process.versions.node), process.versions.node, 'Install supported Node 24 LTS (24.15.0+) or Node 25 (25.8.1+).');
  add('platform', ['darwin', 'linux'].includes(process.platform), process.platform, 'Local preview supports macOS and Linux.');
  let directoryExists = existsSync(dir); let readable = false, writable = false, freeBytes = null;
  if (directoryExists) { try { accessSync(dir, constants.R_OK | constants.X_OK); readable = true; } catch {} try { accessSync(dir, constants.W_OK | constants.X_OK); writable = true; } catch {} try { const fs = statfsSync(dir); freeBytes = fs.bavail * fs.bsize; } catch {} }
  const enoughSpace = freeBytes === null || freeBytes >= 100 * 1024 * 1024;
  add('data-folder', directoryExists && readable && writable && enoughSpace, `${dir}${freeBytes === null ? '' : `; ${Math.floor(freeBytes / 1024 / 1024)} MiB free`}`, 'Check the data folder path and current user permissions; free disk space if low.');
  const remoteWarning = dataLocationWarning(dir);
  add('local-folder', !remoteWarning, dir, 'Move the live database to a local disk folder. Use the external backup folder for cloud copies.');
  const tokenPath = join(dir, 'token');
  let tokenOk = false, tokenDetail = 'token is missing';
  if (existsSync(tokenPath)) {
    try { const mode = statSync(tokenPath).mode & 0o777; tokenOk = process.platform === 'win32' || mode === 0o600; tokenDetail = process.platform === 'win32' ? 'token file exists' : `permissions ${mode.toString(8).padStart(4, '0')}`; }
    catch { tokenDetail = 'token cannot be read'; }
  }
  if (tokenIssue) { tokenOk = false; tokenDetail = tokenIssue; }
  add('cli-token', tokenOk, tokenDetail, 'Restart MenuPilot to create a fresh CLI token with private permissions (0600).');
  let owner = null; try { owner = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')); } catch {}
  const lockStatus = owner ? (apiAvailable ? 'server is reachable' : 'lock exists but server is not reachable') : 'no lock file';
  add('lock', !owner || apiAvailable, lockStatus, 'If a lock remains after a crash, stop MenuPilot and run npm start so lock recovery can verify it.');
  const addressPort = owner?.address && /^http:\/\/127\.0\.0\.1:(\d+)$/.exec(owner.address)?.[1];
  const configuredPort = Number(process.env.MENUPILOT_PORT || 4710);
  const port = addressPort ? Number(addressPort) : configuredPort;
  const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
  const busy = validPort ? await portState(port) : false;
  add('port', validPort && (apiAvailable || !busy), validPort ? `${port}: ${apiAvailable ? 'MenuPilot is listening' : busy ? 'occupied' : 'available'}` : `${process.env.MENUPILOT_PORT}: invalid port`, 'Set MENUPILOT_PORT to an available integer from 1 to 65535.');
  let dbVersion = null, documentFormat = 'not checked', databaseOk = true;
  let dirty = false, localBackupAt = null;
  const dbPath = join(dir, 'menupilot.db');
  if (existsSync(dbPath)) { let db; try { const { DatabaseSync } = await import('node:sqlite'); const { assertValidDocument } = await import('../src/store/schema.js'); const { parseBackup } = await import('../src/store/serialization.js');
    db = new DatabaseSync(dbPath, { readOnly: true }); dbVersion = db.prepare('PRAGMA user_version').get().user_version;
    const integrity = db.prepare('PRAGMA quick_check').all();
    if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') throw new Error('SQLite quick_check failed');
    const record = db.prepare('SELECT record FROM document WHERE id=1').get()?.record;
    if (record === undefined) documentFormat = 'empty';
    else {
      const parsed = JSON.parse(record); const envelope = parsed.document ? parseBackup(JSON.stringify({ version: 2, ...parsed })) : null;
      if (!envelope) throw new Error('document record is invalid'); assertValidDocument(envelope.document);
      documentFormat = `schema ${envelope.schemaVersion}`;
    }
    dirty = db.prepare("SELECT value FROM meta WHERE key='backupDirty'").get()?.value === '1';
  } catch { documentFormat = 'unreadable or invalid'; databaseOk = false; } finally { db?.close(); } }
  add('database-format', databaseOk && (dbVersion === null || dbVersion === 1 || dbVersion === 2), dbVersion === null ? (existsSync(dbPath) ? 'database is unreadable' : 'no database yet') : `SQLite format ${dbVersion}; document ${documentFormat}`, 'Database or document is unreadable. Restore a verified backup with npm run menupilot -- backup verify, then restore it.');
  if (backupsStatus) {
    add('backup-freshness', !backupsStatus.overdue, backupsStatus.lastBackupAt ? `${backupsStatus.lastBackupAt}${backupsStatus.dirty ? '; pending changes' : ''}` : 'no completed backup', 'Keep MenuPilot running until a backup completes; inspect backup errors and available space.');
    add('external-backup', !backupsStatus.externalConfigured || !backupsStatus.externalOverdue, backupsStatus.externalConfigured ? (backupsStatus.lastExternalBackupAt ?? 'no external backup') : 'not configured', 'Check the destination and its sync client; a copied file does not prove cloud synchronization.');
    const damaged = backupsStatus.corruptBackups || backupsStatus.corruptExternalBackups;
    add('backup-integrity', !damaged, damaged ? 'Damaged backups are isolated in quarantine.' : 'no damaged backups', 'Verify the remaining restore points before using them.');
    add('system-clock', !backupsStatus.clockWarning, backupsStatus.clockWarning ? 'automatic backup deletion is paused by the clock warning.' : 'clock check clear', 'Check the system date and time.');
    const backupError = backupsStatus.backupError || backupsStatus.externalError;
    add('backup-error', !backupError, backupError ? 'A backup operation reported an error.' : 'no backup error', 'Review available disk space and the destination folder.');
  } else {
    try { const { listSnapshots } = await import('./backupFiles.js'); localBackupAt = listSnapshots(join(dir, 'backups')).find(entry => !entry.invalid)?.createdAt ?? null; } catch {}
    const age = localBackupAt ? Date.now() - Date.parse(localBackupAt) : Infinity;
    const stale = !localBackupAt || age < 0 || age > 24 * 60 * 60_000 || (dirty && age > 5 * 60_000);
    add('backup-freshness', !stale, localBackupAt ? `${localBackupAt}${dirty ? '; pending changes' : ''}` : 'no completed backup', 'Keep MenuPilot running until a backup completes; inspect backup errors and available space.');
    if (process.env.MENUPILOT_BACKUP_DIR) add('external-backup', false, 'configured; live copy status is unavailable while the server is stopped', 'Start MenuPilot to check external-copy freshness and destination errors.');
  }
  return { node: process.versions.node, dataDir: dir, databaseVersion: dbVersion, documentFormat, lockStatus, checks, warnings };
}

export async function executeReadCommand(command, args, api) {
  const { flags, positional, values } = readArgs(args);
  const allowed = { 'what-changed': ['--since'], simulate: ['--dish', '--menu-price', '--ingredient-price', '--qty', '--volume'] }[command] ?? [];
  const unknown = [...values.keys()].find(key => !allowed.includes(key));
  if (unknown) throw cliError('usage', `Unknown option for ${command}: ${unknown}.`);
  const locale = normalizeLocale(flags.locale);
  const envelope = await api('document');
  const doc = envelope.document;
  const base = { apiVersion: API_VERSION, command, documentId: envelope.documentId, revision: envelope.revision };
  let data, warnings = [];
  if (command === 'what-changed') {
    if (positional.length) throw cliError('usage', 'what-changed accepts options only.');
    data = dashboardOutput(doc, dateFor(values.get('--since')), locale);
  } else if (command === 'dishes') {
    if (positional.length) throw cliError('usage', 'dishes accepts options only.');
    data = doc.recipes.filter(item => item.kind === 'dish').map(item => ({ id: item.id, name: item.name, menuPriceInclVatCents: String(item.menuPriceInclVatCents), menuPriceInclVat: money(item.menuPriceInclVatCents, locale), menuPriceLabel: 'incl. VAT', monthlyVolume: item.monthlyVolume ?? null }));
  } else if (command === 'preps') {
    if (positional.length) throw cliError('usage', 'preps accepts options only.');
    data = doc.recipes.filter(item => item.kind === 'prep').map(item => ({ id: item.id, name: item.name, outputMilli: item.outputMilli, outputUnit: item.outputUnit }));
  } else if (command === 'ingredients') {
    if (positional.length) throw cliError('usage', 'ingredients accepts options only.');
    data = doc.ingredients.map(item => ({ id: item.id, name: item.name, unit: item.unit, currentPrice: unitPackaging(item, locale) }));
  } else if (command === 'dish') {
    if (positional.length !== 1) throw cliError('usage', 'Usage: dish <id|exact name>.');
    let dish;
    try { dish = resolveOne(doc.recipes.filter(r => r.kind === 'dish'), positional[0], 'dish', locale); }
    catch (error) { const prep = doc.recipes.find(r => r.kind === 'prep' && normalized(r.id) === normalized(positional[0]) || r.kind === 'prep' && normalized(r.name) === normalized(positional[0])); if (prep) throw cliError('not-found', `“${prep.name}” is a prep, not a dish.`, exactCandidates([prep], locale)); throw error; }
    const cost = recipeCost(dish, doc);
    const m = metrics({ recipeCostPerPortionMicro: cost.costPerPortionMicro, menuPriceInclVatCents: dish.menuPriceInclVatCents, vatRateBp: dish.vatRateBp, monthlyVolume: dish.monthlyVolume });
    data = { id: dish.id, name: dish.name, menuPriceInclVatCents: String(dish.menuPriceInclVatCents), menuPriceInclVat: money(dish.menuPriceInclVatCents, locale), menuPriceLabel: 'incl. VAT', vatRateBp: dish.vatRateBp,
      portions: dish.portions, monthlyVolume: dish.monthlyVolume ?? null, recipeBasedIngredientCostMicro: cost.costPerPortionMicro?.toString() ?? null,
      recipeBasedIngredientCost: money(cost.costPerPortionMicro, locale, true), contributionMicro: m.contributionMicro?.toString() ?? null,
      contribution: money(m.contributionMicro, locale, true), lines: dish.lines.map(line => { const target = line.ref.kind === 'ingredient' ? doc.ingredients.find(i => i.id === line.ref.id) : doc.recipes.find(r => r.id === line.ref.id); return { id: line.id, ref: line.ref, netQtyMilli: line.netQtyMilli, yieldBp: line.yieldBp,
        target: target ? { id: target.id, name: target.name, kind: line.ref.kind, unit: target.unit ?? target.outputUnit } : null }; }) };
  } else if (command === 'ingredient') {
    if (positional.length !== 1) throw cliError('usage', 'Usage: ingredient <id|exact name>.');
    const ingredient = resolveOne(doc.ingredients, positional[0], 'ingredient', locale);
    data = { id: ingredient.id, name: ingredient.name, unit: ingredient.unit, priceHistory: ingredient.prices.map(price => ({ sequence: price.seq, recordedAt: price.recordedAt, packPriceCents: String(price.packPriceCents), packPrice: money(price.packPriceCents, locale), packPriceLabel: 'excl. VAT', packSizeMilli: price.packSizeMilli })) };
  } else if (command === 'simulate') {
    if (positional.length) throw cliError('usage', 'simulate accepts named options only.');
    const dish = values.get('--dish'); if (!dish) throw cliError('usage', 'Usage: simulate --dish <id|exact name> [options].');
    data = evaluateSimulation(doc, dish, values, locale);
  } else if (command === 'history') data = await api('history');
  else if (command === 'journal') data = await api('journal');
  else if (command === 'backups') { const [list, status] = await Promise.all([api('backups'), api('backups/status')]); data = { entries: list, status }; }
  else if (command === 'status') {
    const status = await api('backups/status'); const state = await api('local/status');
    const statusNotes = statusWarnings(status);
    if (dataLocationWarning(state.dataDir)) statusNotes.push({ code: 'local-folder', message: 'The data folder may be cloud-synced or network-mounted.' });
    data = { mode: 'local', dataDir: state.dataDir,
      lastBackup: status.lastBackupAt, lastExternalBackup: status.lastExternalBackupAt };
    warnings = statusNotes;
  } else throw cliError('usage', `Unknown read command: ${command}.`);
  return { ...base, data: asRecord(data, locale), warnings };
}

function statusWarnings(status) {
  const warnings = [];
  if (status.overdue) warnings.push({ code: 'backup-overdue', message: 'Latest backup is overdue.' });
  if (status.externalOverdue) warnings.push({ code: 'external-backup-overdue', message: 'External backup is overdue.' });
  if (status.backupError || status.externalError) warnings.push({ code: 'backup-error', message: 'A backup operation reported an error.' });
  if (status.corruptBackups || status.corruptExternalBackups) warnings.push({ code: 'backup-integrity', message: 'Damaged backups are present.' });
  if (status.clockWarning) warnings.push({ code: 'system-clock', message: 'System clock warning; retention cleanup is paused.' });
  return warnings;
}

export function serializeCliError(error) {
  return { apiVersion: API_VERSION, error: { code: error.code || 'command-failed', message: error.message || 'MenuPilot could not complete the command.', ...(error.candidates?.length ? { candidates: error.candidates } : {}) } };
}

export { localDoctor, localDataPath, statusWarnings };
