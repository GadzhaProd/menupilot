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

async function fixture(t, document) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-cli-'));
  const dist = join(dir, 'dist');
  const { mkdirSync } = await import('node:fs'); mkdirSync(dist);
  writeFileSync(join(dist, 'index.html'), '<html><head></head><body></body></html>');
  const token = 'ab'.repeat(32);
  const storage = createSqliteStorage(join(dir, 'menupilot.db'), { initialDocument: document });
  storage.backups = { list: () => [], status: () => ({ lastBackupAt: null, lastExternalBackupAt: null, externalConfigured: false,
    dirty: false, overdue: false, externalOverdue: false, backupError: null, externalError: null, clockWarning: false, corruptBackups: 0, corruptExternalBackups: 0 }) };
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
  assert.equal(burger.comparisonCost, '€4.20');
  assert.equal(burger.currentCost, '€4.85');
  assert.equal(burger.monthlyImpact, '-€195.00');
  assert.equal(burger.monthlyVolume, 300);
});

test('CLI simulate shares simulator values and decimal comma parsing', async t => {
  const f = await fixture(t, enDemo());
  const result = await invoke(f.dir, 'simulate', '--dish', 'Classic Burger', '--menu-price', '13,83', '--volume', '300', '--json');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.data.contribution, '€7.84');
  assert.equal(output.data.contributionDelta, '+€0.69');
  assert.equal(output.data.monthlyContributionDelta, '+€206.42');
});

test('CLI ingredient-price and quantity scenarios match the Simulator examples', async t => {
  const f = await fixture(t, enDemo());
  const price = await invoke(f.dir, 'simulate', '--dish', 'dish_classic_burger', '--ingredient-price', 'ing_beef=14', '--json');
  assert.equal(price.status, 0, price.stderr);
  const priceResult = JSON.parse(price.stdout).data;
  assert.equal(priceResult.contributionDelta, '+€0.54');
  assert.equal(priceResult.monthlyContributionDelta, '+€162.00');
  const quantity = await invoke(f.dir, 'simulate', '--dish', 'dish_classic_burger', '--qty', 'l1=160 g', '--json');
  assert.equal(quantity.status, 0, quantity.stderr);
  const quantityResult = JSON.parse(quantity.stdout).data;
  assert.equal(quantityResult.recipeBasedIngredientCost, '€4.51');
  assert.equal(quantityResult.contributionDelta, '+€0.34');
  assert.equal(quantityResult.monthlyContributionDelta, '+€102.00');
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
  assert.equal(burger.comparisonCost, '€ 4,20');
  assert.equal(burger.currentCost, '€ 4,85');
  assert.equal(burger.monthlyImpact, '-€ 195,00');
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
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, 'doctor');
  assert.equal(report.data.databaseVersion, 99);
  assert.equal(report.data.checks.find(check => check.name === 'database-format').ok, false);
  assert.match(result.stdout, /npm start/);
  const checked = new DatabaseSync(join(dir, 'menupilot.db'), { readOnly: true });
  assert.equal(checked.prepare('PRAGMA user_version').get().user_version, 99); checked.close();
});
