import { accessSync, constants, existsSync, readFileSync, statfsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { connect } from 'node:net';
import { createBaselineSnapshot, simulate } from '../src/calc/simulate.js';
import { recipeCost, metrics, selectPriceAtDate } from '../src/calc/costing.js';
import { costChangeCents, monthlyImpactCents, menuMonthlyImpactCents, averageFoodCostTenths } from '../src/calc/impact.js';
import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale, normalizeLocale, parseMoneyToCents } from '../src/calc/money.js';
import { parseQuantityToMilli } from '../src/calc/units.js';

export const API_VERSION = 1;
const isMoney = key => /(?:Cents|Micro)$/.test(key);
const money = (value, locale = 'en', micro = false) => value === null || value === undefined
  ? null : micro ? formatEURFromMicroLocale(value, locale) : formatEURFromCentsLocale(value, locale);
const percent = (value, locale = 'en') => value === null || value === undefined ? null : formatPercentTenthsLocale(value, locale);
const localDataPath = () => resolve(process.env.MENUPILOT_DATA_DIR || (process.platform === 'darwin'
  ? join(homedir(), 'Library/Application Support/MenuPilot')
  : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'menupilot')));

function asRecord(value, locale = 'en') {
  if (Array.isArray(value)) return value.map(item => asRecord(item, locale));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item === 'bigint') {
      const isMicro = /Micro$/.test(key) || /Micro/.test(key);
      const isPercent = /Pct|Tenths/.test(key);
      return [key, isPercent ? percent(item, locale) : money(item, locale, isMicro)];
    }
    if (typeof item === 'number' && isMoney(key)) return [key, money(item, locale)];
    return [key, asRecord(item, locale)];
  }));
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
      if (values.has(arg)) throw cliError('usage', `${arg} can be used only once.`);
      values.set(arg, args[++i]);
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
function resolveOne(entries, value, type, locale = 'en') {
  const id = entries.find(entry => entry.id === value);
  if (id) return id;
  const matches = entries.filter(entry => entry.name.toLocaleLowerCase('en') === value.toLocaleLowerCase('en'));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw cliError('ambiguous', `More than one ${type} has the exact name “${value}”. Choose an ID.`, exactCandidates(matches, locale));
  const suggestions = entries.map(entry => ({ entry, d: distance(entry.name.toLowerCase(), value.toLowerCase()) }))
    .filter(candidate => candidate.d <= Math.max(2, Math.floor(value.length / 4)))
    .sort((a, b) => a.d - b.d).slice(0, 3).map(candidate => candidate.entry);
  throw cliError('not-found', `No ${type} matches “${value}”.${suggestions.length ? ` Perhaps you meant: ${suggestions.map(item => `${item.name} (${item.id})`).join(', ')}.` : ''}`, exactCandidates(suggestions, locale));
}

function dateFor(since) {
  if (!since || since === '30d') return new Date(Date.now() - 30 * 86400000).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(`${since}T00:00:00.000Z`)) || new Date(`${since}T00:00:00.000Z`).toISOString().slice(0, 10) !== since) {
    throw cliError('usage', '--since must be 30d or a valid YYYY-MM-DD date.');
  }
  return `${since}T00:00:00.000Z`;
}

function dashboardOutput(doc, asOf, locale) {
  function priceIssue(recipe, visited = new Set()) {
    if (visited.has(recipe.id)) return null;
    visited.add(recipe.id);
    for (const line of recipe.lines) {
      if (line.ref.kind === 'ingredient') {
        const ingredient = doc.ingredients.find(item => item.id === line.ref.id);
        if (!ingredient || !ingredient.prices.length) return 'cost-unknown';
        if (selectPriceAtDate(ingredient.prices, asOf) === null) return 'no-price-on-date';
      } else {
        const prep = doc.recipes.find(item => item.id === line.ref.id && item.kind === 'prep');
        if (!prep) return 'cost-unknown';
        const issue = priceIssue(prep, visited); if (issue) return issue;
      }
    }
    return null;
  }
  const rows = doc.recipes.filter(recipe => recipe.kind === 'dish').map(dish => {
    const currentCost = recipeCost(dish, doc).costPerPortionMicro;
    let comparisonCost = null, current = null, previous = null, issue = priceIssue(dish);
    try {
      comparisonCost = recipeCost(dish, doc, { asOf }).costPerPortionMicro;
      current = metrics({ recipeCostPerPortionMicro: currentCost, menuPriceInclVatCents: dish.menuPriceInclVatCents, vatRateBp: dish.vatRateBp, monthlyVolume: dish.monthlyVolume });
      previous = metrics({ recipeCostPerPortionMicro: comparisonCost, menuPriceInclVatCents: dish.menuPriceInclVatCents, vatRateBp: dish.vatRateBp, monthlyVolume: dish.monthlyVolume });
    } catch { issue ??= 'cost-unknown'; }
    const status = issue ?? (current?.status === 'cost-unknown' || previous?.status === 'cost-unknown' ? 'cost-unknown' : 'ready');
    const impact = dish.monthlyVolume == null ? null : monthlyImpactCents(current?.monthlyContributionCents ?? null, previous?.monthlyContributionCents ?? null);
    return { id: dish.id, name: dish.name, comparisonCostMicro: comparisonCost, currentCostMicro: currentCost,
      costDeltaCents: costChangeCents(currentCost, comparisonCost), monthlyVolume: dish.monthlyVolume ?? null,
      monthlyImpactCents: impact, currentFoodCostTenthsPct: current?.foodCostTenthsPct ?? null, status };
  });
  const dishes = rows.map(row => ({ id: row.id, name: row.name,
    comparisonCost: money(row.comparisonCostMicro, locale, true), currentCost: money(row.currentCostMicro, locale, true),
    change: money(row.costDeltaCents, locale), monthlyVolume: row.monthlyVolume,
    monthlyImpact: money(row.monthlyImpactCents, locale), status: row.status,
    excludedReason: row.monthlyVolume === null ? 'no monthly volume estimate' : row.monthlyImpactCents === null ? row.status : null }));
  const known = rows.filter(row => row.monthlyImpactCents !== null).map(row => row.monthlyImpactCents);
  const volumeRows = rows.filter(row => row.monthlyVolume !== null);
  const total = volumeRows.length === 0 ? null : menuMonthlyImpactCents(known);
  const excludedWithoutVolume = rows.filter(row => row.monthlyVolume === null).length;
  const excludedWithVolume = volumeRows.filter(row => row.monthlyImpactCents === null).length;
  return { since: asOf.slice(0, 10), dishes, totalMonthlyImpact: total === null ? null : money(total, locale),
    excluded: dishes.filter(row => row.excludedReason !== null).map(({ id, name, excludedReason }) => ({ id, name, reason: excludedReason })),
    excludedWithoutVolume, excludedWithVolume,
    gotMoreExpensive: rows.filter(row => row.costDeltaCents !== null && row.costDeltaCents > 0n).length,
    averageFoodCost: percent(averageFoodCostTenths(rows.flatMap(row => row.currentFoodCostTenthsPct === null ? [] : [row.currentFoodCostTenthsPct])), locale) };
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
  const rawPrice = parseOptions(values, '--ingredient-price');
  if (rawPrice !== undefined) {
    const split = rawPrice.indexOf('='); if (split < 1) throw cliError('invalid-argument', 'Use --ingredient-price <ingredient>=<pack-price>.');
    const ingredient = resolveOne(baseline.ingredients, rawPrice.slice(0, split), 'ingredient', locale);
    try { overrides.ingredientPriceCents[ingredient.id] = parseMoneyToCents(rawPrice.slice(split + 1)); }
    catch (error) { throw cliError('invalid-argument', error.message); }
  }
  const rawQty = parseOptions(values, '--qty');
  if (rawQty !== undefined) {
    const split = rawQty.indexOf('='); if (split < 1) throw cliError('invalid-argument', 'Use --qty <lineId|ingredient>=<quantity unit>.');
    const ref = rawQty.slice(0, split), quantityText = rawQty.slice(split + 1).trim();
    const match = /^(\d+(?:[.,]\d+)?)\s+(kg|g|l|ml|pc)$/i.exec(quantityText);
    if (!match) throw cliError('invalid-unit', 'Quantity must include a supported unit: kg, g, l, ml or pc.');
    const line = dish.lines.map(line => ({ line, target: line.ref.kind === 'ingredient'
      ? baseline.ingredients.find(i => i.id === line.ref.id) : baseline.recipes.find(r => r.id === line.ref.id) }))
      .filter(({ line, target }) => line.id === ref || target?.id === ref || target?.name.toLowerCase() === ref.toLowerCase());
    if (line.length !== 1) throw cliError(line.length ? 'ambiguous' : 'not-found', line.length ? `More than one dish line matches “${ref}”. Use a line ID.` : `No top-level dish line matches “${ref}”.`, line.map(({ line: l, target }) => ({ id: l.id, name: target?.name,
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
  const sign = amount => amount === null ? null : `${amount > 0n ? '+' : ''}${money(amount, locale)}`;
  return { id: dish.id, name: dish.name, status: result.status, menuPriceInclVat: money(result.menuPriceInclVatCents, locale),
    menuPriceLabel: 'incl. VAT', recipeBasedIngredientCost: money(result.ingredientCostCents, locale),
    contribution: money(result.contributionCents, locale), contributionDelta: sign(d(result.contributionCents, base.contributionCents)),
    monthlyVolume: result.monthlyVolume, monthlyContribution: money(result.monthlyContributionCents, locale),
    monthlyContributionDelta: sign(d(result.monthlyContributionCents, base.monthlyContributionCents)),
    foodCost: percent(result.foodCostPct, locale), contributionMargin: percent(result.marginPct, locale) };
}

function portState(port) {
  return new Promise(resolveState => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(400);
    socket.once('connect', () => { socket.destroy(); resolveState(true); });
    socket.once('error', () => resolveState(false)); socket.once('timeout', () => { socket.destroy(); resolveState(false); });
  });
}
function networkWarning(path) { return /\/Volumes\/|\/Network\/|\/mnt\/|\/media\/|\/run\/user\/.+\/gvfs\//i.test(path) || /icloud|dropbox|onedrive|google drive|syncthing/i.test(path); }
async function localDoctor(dir, apiAvailable, backupsStatus) {
  const checks = [], warnings = [];
  const add = (name, ok, detail, advice = null) => { checks.push({ name, ok, detail, advice }); if (!ok && advice) warnings.push(advice); };
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  add('node', (major === 24 && minor >= 15) || (major === 25 && (minor > 8 || (minor === 8 && patch >= 1))), process.versions.node, 'Install supported Node 24 LTS (24.15.0+) or Node 25 (25.8.1+).');
  add('platform', ['darwin', 'linux'].includes(process.platform), process.platform, 'Local preview supports macOS and Linux.');
  let directoryExists = existsSync(dir); let readable = false, writable = false, freeBytes = null;
  if (directoryExists) { try { accessSync(dir, constants.R_OK | constants.X_OK); readable = true; } catch {} try { accessSync(dir, constants.W_OK | constants.X_OK); writable = true; } catch {} try { const fs = statfsSync(dir); freeBytes = fs.bavail * fs.bsize; } catch {} }
  const enoughSpace = freeBytes === null || freeBytes >= 100 * 1024 * 1024;
  add('data-folder', directoryExists && readable && writable && enoughSpace, `${dir}${freeBytes === null ? '' : `; ${Math.floor(freeBytes / 1024 / 1024)} MiB free`}`, 'Check the data folder path and current user permissions; free disk space if low.');
  add('local-folder', !networkWarning(dir), dir, 'Move the live database to a local disk folder. Cloud and network path detection is heuristic.');
  let owner = null; try { owner = JSON.parse(readFileSync(join(dir, 'lock'), 'utf8')); } catch {}
  const lockStatus = owner ? (apiAvailable ? 'server is reachable' : 'lock exists but server is not reachable') : 'no lock file';
  add('lock', !owner || apiAvailable, lockStatus, 'If a lock remains after a crash, stop MenuPilot and run npm start so lock recovery can verify it.');
  const addressPort = owner?.address && /^http:\/\/127\.0\.0\.1:(\d+)$/.exec(owner.address)?.[1];
  const configuredPort = Number(process.env.MENUPILOT_PORT || 4710);
  const port = addressPort ? Number(addressPort) : configuredPort;
  const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
  const busy = validPort ? await portState(port) : false;
  add('port', validPort && (apiAvailable || !busy), validPort ? `${port}: ${apiAvailable ? 'MenuPilot is listening' : busy ? 'occupied' : 'available'}` : `${process.env.MENUPILOT_PORT}: invalid port`, 'Set MENUPILOT_PORT to an available integer from 1 to 65535.');
  let dbVersion = null, documentFormat = 'not checked';
  let dirty = false, localBackupAt = null;
  const dbPath = join(dir, 'menupilot.db');
  if (existsSync(dbPath)) { let db; try { const { DatabaseSync } = await import('node:sqlite'); db = new DatabaseSync(dbPath, { readOnly: true }); dbVersion = db.prepare('PRAGMA user_version').get().user_version;
    const record = db.prepare('SELECT record FROM document WHERE id=1').get()?.record; documentFormat = record ? `schema ${JSON.parse(record).schemaVersion ?? 'legacy'}` : 'empty';
    dirty = db.prepare("SELECT value FROM meta WHERE key='backupDirty'").get()?.value === '1'; } catch { documentFormat = 'unreadable'; } finally { db?.close(); } }
  add('database-format', dbVersion === null || dbVersion === 1 || dbVersion === 2, dbVersion === null ? 'no database yet' : `SQLite format ${dbVersion}; document ${documentFormat}`, 'Use a supported MenuPilot version or restore a verified backup; do not edit the database manually.');
  if (backupsStatus) {
    add('backup-freshness', !backupsStatus.overdue, backupsStatus.lastBackupAt ? `${backupsStatus.lastBackupAt}${backupsStatus.dirty ? '; pending changes' : ''}` : 'no completed backup', 'Keep MenuPilot running until a backup completes; inspect backup errors and available space.');
    add('external-backup', !backupsStatus.externalConfigured || !backupsStatus.externalOverdue, backupsStatus.externalConfigured ? (backupsStatus.lastExternalBackupAt ?? 'no external backup') : 'not configured', 'Check the destination and its sync client; a copied file does not prove cloud synchronization.');
    if (backupsStatus.corruptBackups || backupsStatus.corruptExternalBackups) warnings.push('Damaged backups are isolated in quarantine; verify the remaining restore points.');
    if (backupsStatus.clockWarning) warnings.push('System clock warning: automatic backup deletion is paused. Check the date.');
    if (backupsStatus.backupError || backupsStatus.externalError) warnings.push('A backup operation reported an error. Review available disk space and the destination folder.');
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
  const [version, envelope] = await Promise.all([api('version'), api('document')]);
  const doc = envelope.document;
  const base = { apiVersion: API_VERSION, command, documentId: version.documentId, revision: version.revision };
  let data, warnings = [];
  if (command === 'what-changed') {
    if (positional.length) throw cliError('usage', 'what-changed accepts options only.');
    data = dashboardOutput(doc, dateFor(values.get('--since')), locale);
  } else if (command === 'dishes') {
    if (positional.length) throw cliError('usage', 'dishes accepts options only.');
    data = doc.recipes.filter(item => item.kind === 'dish').map(item => ({ id: item.id, name: item.name, menuPriceInclVat: money(item.menuPriceInclVatCents, locale), menuPriceLabel: 'incl. VAT', monthlyVolume: item.monthlyVolume ?? null }));
  } else if (command === 'preps') {
    if (positional.length) throw cliError('usage', 'preps accepts options only.');
    data = doc.recipes.filter(item => item.kind === 'prep').map(item => ({ id: item.id, name: item.name, outputMilli: item.outputMilli, outputUnit: item.outputUnit }));
  } else if (command === 'ingredients') {
    if (positional.length) throw cliError('usage', 'ingredients accepts options only.');
    data = doc.ingredients.map(item => ({ id: item.id, name: item.name, unit: item.unit, currentPrice: unitPackaging(item, locale) }));
  } else if (command === 'dish') {
    if (positional.length !== 1) throw cliError('usage', 'Usage: dish <id|exact name>.');
    const dish = resolveOne(doc.recipes.filter(r => r.kind === 'dish'), positional[0], 'dish', locale);
    const cost = recipeCost(dish, doc);
    const m = metrics({ recipeCostPerPortionMicro: cost.costPerPortionMicro, menuPriceInclVatCents: dish.menuPriceInclVatCents, vatRateBp: dish.vatRateBp, monthlyVolume: dish.monthlyVolume });
    data = { ...dish, menuPriceInclVat: money(dish.menuPriceInclVatCents, locale), menuPriceLabel: 'incl. VAT', recipeBasedIngredientCost: money(cost.costPerPortionMicro, locale, true), contribution: money(m.contributionMicro, locale, true), lines: dish.lines.map(line => ({ ...line, target: doc.ingredients.find(i => i.id === line.ref.id) ?? doc.recipes.find(r => r.id === line.ref.id) })) };
  } else if (command === 'ingredient') {
    if (positional.length !== 1) throw cliError('usage', 'Usage: ingredient <id|exact name>.');
    const ingredient = resolveOne(doc.ingredients, positional[0], 'ingredient', locale);
    data = { id: ingredient.id, name: ingredient.name, unit: ingredient.unit, priceHistory: ingredient.prices.map(price => ({ sequence: price.seq, recordedAt: price.recordedAt, packPrice: money(price.packPriceCents, locale), packPriceLabel: 'excl. VAT', packSizeMilli: price.packSizeMilli })) };
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
    if (networkWarning(state.dataDir)) statusNotes.push('The data folder may be cloud-synced or network-mounted.');
    data = { mode: 'local', dataDir: state.dataDir, documentId: version.documentId, revision: version.revision,
      lastBackup: status.lastBackupAt, lastExternalBackup: status.lastExternalBackupAt, warnings: statusNotes };
    warnings = data.warnings;
  } else throw cliError('usage', `Unknown read command: ${command}.`);
  return { ...base, data: asRecord(data, locale), warnings };
}

function statusWarnings(status) {
  const warnings = [];
  if (status.overdue) warnings.push('Latest backup is overdue.');
  if (status.externalOverdue) warnings.push('External backup is overdue.');
  if (status.backupError || status.externalError) warnings.push('A backup operation reported an error.');
  if (status.corruptBackups || status.corruptExternalBackups) warnings.push('Damaged backups are present.');
  if (status.clockWarning) warnings.push('System clock warning; retention cleanup is paused.');
  return warnings;
}

export function serializeCliError(error) {
  return { apiVersion: API_VERSION, error: { code: error.code || 'command-failed', message: error.message || 'MenuPilot could not complete the command.', ...(error.candidates?.length ? { candidates: error.candidates } : {}) } };
}

export { localDoctor, localDataPath, statusWarnings };
