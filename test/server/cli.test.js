import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createSqliteStorage } from '../../server/sqlite.js';
import { serveLocal } from '../../server/http.js';
import { shiftDemoDates, DEMO_REFERENCE_NOW } from '../../src/store/demo.js';
import { readFileSync as readDemoFile } from 'node:fs';
import { assertQuickCheck, dateFor, isSupportedNode, localDoctor } from '../../server/cliRead.js';
import { hasValidOpenResult } from '../../server/cliSecurity.js';
import { createServer } from 'node:net';

async function fixture(t, document, backupStatus = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-'));
  const dist = join(dir, 'dist');
  const { mkdirSync } = await import('node:fs'); mkdirSync(dist);
  writeFileSync(join(dist, 'index.html'), '<html><head></head><body></body></html>');
  const token = 'ab'.repeat(32);
  const storage = createSqliteStorage(join(dir, 'menupilot.db'), { initialDocument: document });
  storage.backups = { list: () => [], status: () => ({ lastBackupAt: null, lastExternalBackupAt: null, externalConfigured: false,
    dirty: false, overdue: false, externalOverdue: false, backupError: null, externalError: null, clockWarning: false, corruptBackups: 0, corruptExternalBackups: 0, ...backupStatus }) };
  const server = await serveLocal({ storage, dataDir: dir, distDir: dist, port: 0, cliToken: token, instanceId: 'test-instance' });
  writeFileSync(join(dir, 'lock'), JSON.stringify({ address: server.address, instanceId: 'test-instance' }));
  writeFileSync(join(dir, 'token'), token); chmodSync(join(dir, 'token'), 0o600);
  t.after(async () => { await server.close(); storage.close(); rmSync(dir, { recursive: true, force: true }); });
  return { dir, server, storage, token };
}

function invoke(dir, ...args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['server/cli.js', ...args], { cwd: process.cwd(), env: { ...process.env, MENUPILOT_DATA_DIR: dir } });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

const enDemo = () => shiftDemoDates(JSON.parse(readDemoFile(new URL('../../data/demo.json', import.meta.url), 'utf8')), '2026-10-22T12:00:00.000Z');
const nlDemo = () => shiftDemoDates(JSON.parse(readDemoFile(new URL('../../data/demo.nl.json', import.meta.url), 'utf8')), '2026-10-22T12:00:00.000Z');

test('CLI JSON what-changed matches the Dashboard gold values and has a stable envelope', async t => {
  const f = await fixture(t, enDemo());
  const result = await invoke(f.dir, 'what-changed', '--since', '30d', '--json');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(output), ['apiVersion', 'command', 'documentId', 'revision', 'data', 'warnings']);
  assert.equal(output.apiVersion, 1);
  assert.equal(output.command, 'what-changed');
  const burger = output.data.dishes.find(row => row.name === 'Classic Burger');
  assert.deepEqual(burger.comparisonCost, { micro: '4200000', display: '€4.20' });
  assert.deepEqual(burger.currentCost, { micro: '4850000', display: '€4.85' });
  assert.deepEqual(burger.monthlyImpact, { cents: '-19500', display: '-€195.00' });
  assert.equal(burger.monthlyVolume, 300);
});

test('CLI simulate shares simulator values and decimal comma parsing', async t => {
  const f = await fixture(t, enDemo());
  const result = await invoke(f.dir, 'simulate', '--dish', 'Classic Burger', '--menu-price', '13,83', '--volume', '300', '--json');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.data.contribution, { cents: '784', display: '€7.84' });
  assert.deepEqual(output.data.contributionDelta, { cents: '69', display: '+€0.69' });
  assert.deepEqual(output.data.monthlyContributionDelta, { cents: '20642', display: '+€206.42' });
});

test('CLI ingredient-price and quantity scenarios match the Simulator examples', async t => {
  const f = await fixture(t, enDemo());
  const price = await invoke(f.dir, 'simulate', '--dish', 'dish_classic_burger', '--ingredient-price', 'ing_beef=14', '--json');
  assert.equal(price.status, 0, price.stderr);
  const priceResult = JSON.parse(price.stdout).data;
  assert.equal(priceResult.contributionDelta.display, '+€0.54');
  assert.equal(priceResult.monthlyContributionDelta.display, '+€162.00');
  const quantity = await invoke(f.dir, 'simulate', '--dish', 'dish_classic_burger', '--qty', 'l1=160 g', '--json');
  assert.equal(quantity.status, 0, quantity.stderr);
  const quantityResult = JSON.parse(quantity.stdout).data;
  assert.equal(quantityResult.recipeBasedIngredientCost.display, '€4.51');
  assert.equal(quantityResult.contributionDelta.display, '+€0.34');
  assert.equal(quantityResult.monthlyContributionDelta.display, '+€102.00');
});

test('CLI exact-name ambiguity and unavailable-server errors use JSON error contract', async t => {
  const f = await fixture(t, enDemo());
  const unavailableDir = mkdtempSync(join(tmpdir(), 'menupilot-cli-offline-'));
  t.after(() => rmSync(unavailableDir, { recursive: true, force: true }));
  const unavailable = await invoke(unavailableDir, 'dishes', '--json');
  assert.notEqual(unavailable.status, 0);
  assert.match(JSON.parse(unavailable.stderr).error.message, /npm start/);
  const missing = await invoke(f.dir, 'dish', 'no such dish', '--json');
  assert.notEqual(missing.status, 0);
  assert.equal(JSON.parse(missing.stderr).error.code, 'not-found');
});

test('administrative commands keep unavailable-server exit code 3', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-offline-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = await invoke(dir, 'open-url', '--json');
  assert.equal(result.status, 3);
  assert.equal(JSON.parse(result.stderr).error.code, 'unavailable');
});

test('CLI refuses duplicate exact names and returns candidate identities', async t => {
  const doc = enDemo();
  const burger = doc.recipes.find(item => item.name === 'Classic Burger');
  doc.recipes.push({ ...structuredClone(burger), id: 'dish_classic_burger_copy' });
  const f = await fixture(t, doc);
  const result = await invoke(f.dir, 'dish', 'CLASSIC BURGER', '--json');
  assert.equal(result.status, 4);
  const error = JSON.parse(result.stderr).error;
  assert.equal(error.code, 'ambiguous');
  assert.deepEqual(error.candidates.map(candidate => candidate.id), ['dish_classic_burger', 'dish_classic_burger_copy']);
  const human = await invoke(f.dir, 'dish', 'CLASSIC BURGER');
  assert.equal(human.status, 4);
  assert.match(human.stderr, /dish_classic_burger: Classic Burger/);
  assert.match(human.stderr, /dish_classic_burger_copy: Classic Burger/);
});

test('CLI rejects a wrong private token and incompatible quantity units', async t => {
  const f = await fixture(t, enDemo());
  const badToken = 'cd'.repeat(32);
  writeFileSync(join(f.dir, 'token'), badToken); chmodSync(join(f.dir, 'token'), 0o600);
  const rejected = await invoke(f.dir, 'dishes', '--json');
  assert.equal(rejected.status, 5);
  assert.equal(JSON.parse(rejected.stderr).error.code, 'unauthorized');
  writeFileSync(join(f.dir, 'token'), f.token); chmodSync(join(f.dir, 'token'), 0o600);
  const doc = enDemo(); const burger = doc.recipes.find(item => item.id === 'dish_classic_burger');
  const line = burger.lines[0];
  const result = await invoke(f.dir, 'simulate', '--dish', burger.id, '--qty', `${line.id}=1 pc`, '--json');
  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stderr).error.code, 'invalid-unit');
});

test('Dutch locale uses Dutch currency formatting for the same Dashboard data', async t => {
  const f = await fixture(t, nlDemo());
  const result = await invoke(f.dir, 'what-changed', '--since', '30d', '--locale', 'nl', '--json');
  assert.equal(result.status, 0, result.stderr);
  const burger = JSON.parse(result.stdout).data.dishes.find(row => row.name === 'Klassieke burger');
  assert.equal(burger.comparisonCost.micro, '4200000');
  assert.equal(burger.currentCost.micro, '4850000');
  assert.equal(burger.monthlyImpact.cents, '-19500');
  assert.equal(burger.currentCost.display, '€ 4,85');
});

test('CLI what-changed human output localizes labels in Dutch', async t => {
  const f = await fixture(t, nlDemo());
  const result = await invoke(f.dir, 'what-changed', '--since', '30d', '--locale', 'nl');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wat is er veranderd sinds/);
  assert.match(result.stdout, /Maandelijkse bijdrage van het menu:/);
  assert.match(result.stdout, /Uitgesloten:/);
  assert.doesNotMatch(result.stdout, /What changed|Menu monthly impact|Excluded:/);
});

test('ingredient and recipe reads include UI-ready quantities, VAT, yields, and unit prices', async t => {
  const f = await fixture(t, enDemo());
  const ingredientResult = await invoke(f.dir, 'ingredient', 'ing_beef', '--json');
  assert.equal(ingredientResult.status, 0, ingredientResult.stderr);
  const ingredient = JSON.parse(ingredientResult.stdout).data;
  const latest = ingredient.priceHistory.at(-1);
  assert.equal(latest.packSizeMilli, 1_000_000);
  assert.deepEqual(latest.packSize, { value: '1', display: '1 kg' });
  assert.deepEqual(latest.unitPrice, { value: { cents: '1700', per: 'kg' }, display: '€17.00/kg' });
  const dishResult = await invoke(f.dir, 'dish', 'dish_classic_burger', '--json');
  assert.equal(dishResult.status, 0, dishResult.stderr);
  const dish = JSON.parse(dishResult.stdout).data;
  assert.deepEqual(dish.vatRate, { value: '9', display: '9%' });
  assert.ok(dish.lines.every(line => line.quantity?.display && line.yield?.display));
  assert.ok(dish.lines.some(line => line.quantity.display.endsWith('g') || line.quantity.display.endsWith('kg')));
  const preps = JSON.parse((await invoke(f.dir, 'preps', '--json')).stdout).data;
  assert.ok(preps.every(prep => prep.output?.display));
});

test('read and propose responses carry current backup and health warnings', async t => {
  const f = await fixture(t, enDemo(), { overdue: true, externalOverdue: true, backupError: 'denied', externalError: 'offline' });
  const expected = ['backup-overdue', 'external-backup-overdue', 'backup-error'];
  for (const command of [['status'], ['what-changed'], ['dishes'], ['dish', 'dish_classic_burger'], ['ingredients'], ['ingredient', 'ing_beef'], ['preps'], ['simulate', '--dish', 'dish_classic_burger'], ['history'], ['journal'], ['backups'], ['plans']]) {
    const result = await invoke(f.dir, ...command, '--json');
    assert.equal(result.status, 0, `${command.join(' ')}: ${result.stderr}`);
    const actual = JSON.parse(result.stdout).warnings.map(item => item.code);
    for (const code of expected) assert.ok(actual.includes(code), `${command.join(' ')} missing ${code}`);
  }
  const proposed = await invoke(f.dir, 'propose', 'add-price', '--ingredient', 'ing_beef', '--pack-price', '18.00', '--pack-size', '1 kg', '--json');
  assert.equal(proposed.status, 0, proposed.stderr);
  assert.deepEqual(JSON.parse(proposed.stdout).warnings.map(item => item.code), expected);
  const planId = JSON.parse(proposed.stdout).data.id;
  const planStatus = await invoke(f.dir, 'plan', 'status', planId, '--json');
  assert.equal(planStatus.status, 0, planStatus.stderr);
  assert.deepEqual(JSON.parse(planStatus.stdout).warnings.map(item => item.code), expected);
});

test('all read commands return the versioned envelope through authenticated API routes', async t => {
  const f = await fixture(t, enDemo());
  const commands = [
    ['status'], ['dishes'], ['dish', 'dish_classic_burger'], ['ingredients'],
    ['ingredient', 'ing_beef'], ['preps'], ['history'], ['journal'], ['backups'],
  ];
  for (const command of commands) {
    const result = await invoke(f.dir, ...command, '--json');
    assert.equal(result.status, 0, `${command.join(' ')}: ${result.stderr}`);
    const data = JSON.parse(result.stdout);
    assert.equal(data.apiVersion, 1);
    assert.equal(data.command, command[0]);
    assert.equal(data.revision, 0);
    assert.ok(Object.hasOwn(data, 'warnings'));
  }
});

test('offline doctor reports a bad database format without opening it for writing', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-doctor-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(dir, 'menupilot.db'));
  db.exec('PRAGMA user_version=99'); db.close();
  const result = await invoke(dir, 'doctor', '--json');
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, 'doctor');
  assert.equal(report.data.databaseVersion, 99);
  assert.equal(report.data.checks.find(check => check.name === 'database-format').ok, false);
  assert.match(result.stdout, /npm start/);
  const checked = new DatabaseSync(join(dir, 'menupilot.db'), { readOnly: true });
  assert.equal(checked.prepare('PRAGMA user_version').get().user_version, 99); checked.close();
});

test('doctor accepts a healthy initialized SQLite database with no saved document row', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-doctor-empty-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const storage = createSqliteStorage(join(dir, 'menupilot.db'));
  storage.close();
  const report = await localDoctor(dir, false, null);
  const check = report.checks.find(item => item.name === 'database-format');
  assert.equal(check.ok, true);
  assert.equal(report.documentFormat, 'empty');
});

test('date ranges use Dashboard UTC date and end-of-day semantics; future dates are rejected', () => {
  const daysAgo = days => { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setTime(date.getTime() - days * 86400000); return date.toISOString().slice(0, 10); };
  assert.equal(dateFor('30d'), `${daysAgo(30)}T23:59:59.999Z`);
  assert.equal(dateFor('7d'), `${daysAgo(7)}T23:59:59.999Z`);
  assert.equal(dateFor('90d'), `${daysAgo(90)}T23:59:59.999Z`);
  assert.throws(() => dateFor('2099-01-01'), error => error.code === 'invalid-argument');
});

test('doctor checks the supported Node boundaries, lock ownership, and occupied port', async t => {
  assert.equal(isSupportedNode('24.15.0'), true); assert.equal(isSupportedNode('24.14.9'), false);
  assert.equal(isSupportedNode('25.8.1'), true); assert.equal(isSupportedNode('25.8.0'), false);
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-doctor-state-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  writeFileSync(join(dir, 'lock'), JSON.stringify({ address: `http://127.0.0.1:${port}`, instanceId: 'stale' }));
  const previous = process.env.MENUPILOT_PORT; process.env.MENUPILOT_PORT = String(port);
  t.after(() => { if (previous === undefined) delete process.env.MENUPILOT_PORT; else process.env.MENUPILOT_PORT = previous; server.close(); });
  const report = await localDoctor(dir, false, null);
  assert.equal(report.checks.find(check => check.name === 'lock').ok, false);
  assert.equal(report.checks.find(check => check.name === 'port').ok, false);
});

test('volume must be a safe integer and no-volume dishes do not contribute a menu total', async t => {
  const f = await fixture(t, enDemo());
  const invalid = await invoke(f.dir, 'simulate', '--dish', 'Classic Burger', '--volume', '9007199254740992', '--json');
  assert.equal(invalid.status, 2); assert.equal(JSON.parse(invalid.stderr).error.code, 'invalid-argument');
  const doc = enDemo(); for (const recipe of doc.recipes) if (recipe.kind === 'dish') recipe.monthlyVolume = null;
  const empty = await fixture(t, doc);
  const result = await invoke(empty.dir, 'what-changed', '--since', '30d', '--json');
  assert.equal(JSON.parse(result.stdout).data.totalMonthlyImpact, null);
});

test('quantity decimal comma and substring lookup suggestions stay non-selecting', async t => {
  const f = await fixture(t, enDemo());
  const qty = await invoke(f.dir, 'simulate', '--dish', 'Classic Burger', '--qty', 'l1=0,16 kg', '--json');
  assert.equal(qty.status, 0, qty.stderr);
  const missing = await invoke(f.dir, 'ingredient', 'beef', '--json');
  const error = JSON.parse(missing.stderr).error;
  assert.equal(missing.status, 4);
  assert.equal(error.code, 'not-found');
  assert.ok(error.candidates.some(candidate => candidate.id === 'ing_beef'));
});

test('offline doctor fails on a present but unreadable SQLite file and advises backup recovery', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-doctor-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'menupilot.db'), 'not a sqlite database');
  const result = await invoke(dir, 'doctor', '--json');
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const check = report.data.checks.find(item => item.name === 'database-format');
  assert.equal(check.ok, false);
  assert.match(check.advice, /restore a verified backup/i);
});

test('offline doctor fails on a readable SQLite file with an invalid document record', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-doctor-document-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(dir, 'menupilot.db'));
  db.exec("CREATE TABLE document(id INTEGER PRIMARY KEY, record TEXT NOT NULL); CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=2;");
  db.prepare('INSERT INTO document(id,record) VALUES(1,?)').run('{"document":"bad"}'); db.close();
  const result = await invoke(dir, 'doctor', '--json');
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.data.checks.find(item => item.name === 'database-format').ok, false);
});

test('doctor rejects quick_check failures and browser-open responses must contain no extra capability fields', () => {
  assert.throws(() => assertQuickCheck([{ quick_check: 'row 3 missing' }]), /quick_check failed/);
  assert.doesNotThrow(() => assertQuickCheck([{ quick_check: 'ok' }]));
  const address = 'http://127.0.0.1:4710';
  assert.equal(hasValidOpenResult({ opened: true }), true);
  assert.equal(hasValidOpenResult({ url: 'secret' }), false);
  assert.equal(hasValidOpenResult({ opened: true, url: 'secret' }), false);
});

test('doctor reports private token failures instead of exiting before a report', async t => {
  const f = await fixture(t, enDemo());
  chmodSync(join(f.dir, 'token'), 0o644);
  const result = await invoke(f.dir, 'doctor', '--json');
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const token = report.data.checks.find(item => item.name === 'cli-token');
  assert.equal(token.ok, false);
  assert.match(token.advice, /0600/);
  rmSync(join(f.dir, 'token'));
  const missing = await invoke(f.dir, 'doctor', '--json');
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).data.checks.find(check => check.name === 'cli-token').ok, false);
  writeFileSync(join(f.dir, 'token'), 'wrong-token'); chmodSync(join(f.dir, 'token'), 0o600);
  const rejected = await invoke(f.dir, 'doctor', '--json');
  assert.equal(rejected.status, 1);
  assert.match(JSON.parse(rejected.stdout).data.checks.find(check => check.name === 'cli-token').detail, /rejected/);
});

test('help goes to stdout with exit 0; JSON amounts retain cents across locales', async t => {
  const f = await fixture(t, enDemo());
  const help = await invoke(f.dir, '--help');
  assert.equal(help.status, 0); assert.match(help.stdout, /Usage:/); assert.equal(help.stderr, '');
  const en = JSON.parse((await invoke(f.dir, 'dish', 'DISH_CLASSIC_BURGER', '--json')).stdout);
  const nl = JSON.parse((await invoke(f.dir, 'dish', 'dish_classic_burger', '--locale', 'nl', '--json')).stdout);
  assert.equal(en.data.menuPriceInclVatCents, nl.data.menuPriceInclVatCents);
  assert.equal(en.data.recipeBasedIngredientCostMicro, nl.data.recipeBasedIngredientCostMicro);
  assert.notEqual(en.data.menuPriceInclVat.display, nl.data.menuPriceInclVat.display);
  assert.equal(typeof en.data.menuPriceInclVatCents, 'string');
});

test('multiple quantity and price overrides are accepted; normalized lookup and prep hint are clear', async t => {
  const f = await fixture(t, enDemo());
  const doc = enDemo(); const burger = doc.recipes.find(item => item.id === 'dish_classic_burger');
  const line = burger.lines[0];
  const target = doc.ingredients.find(item => item.id === line.ref.id) ?? doc.recipes.find(item => item.id === line.ref.id);
  const unit = target.unit ?? target.outputUnit;
  const secondLine = burger.lines[1];
  const secondTarget = doc.ingredients.find(item => item.id === secondLine.ref.id);
  const multiple = await invoke(f.dir, 'simulate', '--dish', ' DISH_CLASSIC_BURGER ', '--ingredient-price', 'ing_beef=14', '--ingredient-price', 'ing_tomatoes=7', '--qty', `${line.id}=1 ${unit}`, '--qty', `${secondLine.id}=2 ${secondTarget.unit}`, '--json');
  assert.equal(multiple.status, 0, multiple.stderr);
  const duplicateByAlias = await invoke(f.dir, 'simulate', '--dish', burger.id, '--qty', `${line.id}=1 ${unit}`, '--qty', `${target.name}=2 ${unit}`, '--json');
  assert.equal(duplicateByAlias.status, 2);
  assert.match(JSON.parse(duplicateByAlias.stderr).error.message, /already set by an earlier --qty/);
  const duplicateById = await invoke(f.dir, 'simulate', '--dish', burger.id, '--qty', `${line.id}=1 ${unit}`, '--qty', `${line.id}=2 ${unit}`, '--json');
  assert.equal(duplicateById.status, 2);
  assert.match(JSON.parse(duplicateById.stderr).error.message, /already set by an earlier --qty/);
  const duplicatePrice = await invoke(f.dir, 'simulate', '--dish', burger.id, '--ingredient-price', 'ing_beef=14', '--ingredient-price', 'ING_BEEF=15', '--json');
  assert.equal(duplicatePrice.status, 2);
  assert.match(JSON.parse(duplicatePrice.stderr).error.message, /already set by an earlier --ingredient-price/);
  const unusedDoc = enDemo(); unusedDoc.ingredients.push({ ...structuredClone(unusedDoc.ingredients[0]), id: 'ing_unused', name: 'Unused ingredient' });
  const unusedFixture = await fixture(t, unusedDoc);
  const unusedPrice = await invoke(unusedFixture.dir, 'simulate', '--dish', burger.id, '--ingredient-price', 'ing_unused=12', '--json');
  assert.equal(unusedPrice.status, 4);
  assert.equal(JSON.parse(unusedPrice.stderr).error.message, 'Ingredient not used in dish: “ing_unused”.');
  const prep = doc.recipes.find(item => item.kind === 'prep');
  const lookup = await invoke(f.dir, 'dish', prep.name, '--json');
  assert.equal(JSON.parse(lookup.stderr).error.code, 'not-found');
  assert.match(JSON.parse(lookup.stderr).error.message, /is a prep, not a dish/);
});

test('CLI refuses unsafe token permissions before making authenticated requests', async t => {
  const f = await fixture(t, enDemo());
  chmodSync(join(f.dir, 'token'), 0o644);
  const result = await invoke(f.dir, 'dishes', '--json');
  assert.equal(result.status, 5);
  assert.match(JSON.parse(result.stderr).error.message, /permissions 0600/);
});

test('CLI ingredients human output formats money instead of object coercion', async t => {
  const f = await fixture(t, enDemo());
  const result = await invoke(f.dir, 'ingredients');
  assert.equal(result.status, 0); assert.doesNotMatch(result.stdout, /\[object Object\]/);
  assert.match(result.stdout, /€/); assert.match(result.stdout, /excl. VAT/);
});

test('CLI dish human output uses formatted money and never prints raw micro-euro fields', async t => {
  const f = await fixture(t, enDemo());
  const result = await invoke(f.dir, 'dish', 'dish_classic_burger');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Recipe-based ingredient cost: .*excl\. VAT/);
  assert.match(result.stdout, /Contribution: .*excl\. VAT/);
  assert.match(result.stdout, /Menu price: .*incl\. VAT/);
  assert.doesNotMatch(result.stdout, /(?:Micro|Cents)\b/);
});
