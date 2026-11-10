import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStorage } from '../../server/sqlite.js';
import { serveLocal } from '../../server/http.js';
import { signIn } from './session-helper.js';
import { smallDocument, line } from '../store/fixtures.js';
import { dashboardData } from '../../src/calc/dashboard.js';
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-all-'));
  let time = Date.parse('2026-10-22T12:00:00Z');
  const now = () => time;
  const doc = smallDocument();
  doc.recipes[0].lines.push(line('second', 'ingredient', 'i2', 500000));
  doc.recipes[1].monthlyVolume = 123;
  const s = createSqliteStorage(join(dir, 'data.db'), { initialDocument: doc, now });
  const plans = ['i1', 'i2'].map(ingredient => s.plans.propose({ ingredient, packPrice: '18.01', packSize: '1kg' }));
  t.after(() => { s.close(); rmSync(dir, { recursive: true }); });
  return { s, dir, now, plans, ids: plans.map(p => p.id), advance: ms => { time += ms; } };
}
const rows = s => ['document', 'plans', 'ops', 'journal', 'history', 'meta'].map(table => s.db.prepare(`SELECT * FROM ${table}`).all());
const apply = (s, ids, opId = 'invoice') => s.plans.applyAll(ids, s.plans.reviewAll(ids).consequencesFingerprint, opId);

test('apply-all: combined review matches Dashboard, one revision/receipt, audit identifies every plan; durable replay', t => {
  const { s, ids, plans, dir, now } = fixture(t);
  const before = rows(s), review = s.plans.reviewAll(ids);
  assert.deepEqual(rows(s), before);
  assert.deepEqual(review.plans.map(p => p.id).sort(), [...ids].sort());
  const result = apply(s, ids);
  const dash = dashboardData(result.document, '2026-10-22T11:59:59.999Z');
  assert.equal(review.effects.totalMonthlyImpactCents, String(dash.totalMonthlyImpactCents));
  assert.equal(review.effects.dishes[0].currentCostMicro, String(dash.dishes[0].currentCostMicro));
  assert.equal(review.effects.preps[0].currentBatchMicro, String(dash.preps[0].currentBatchMicro));
  assert.equal(result.revision, 1);
  assert.deepEqual(result.document.ingredients.map(i => i.prices.length), [2, 2]);
  assert.deepEqual(s.journal.list()[0].planIds, [...ids].sort());
  assert.equal(s.journal.list()[0].confirmedBy, 'ui');
  for (const id of ids) {
    assert.equal(s.plans.get(id).status, 'applied');
    assert.deepEqual(s.plans.get(id).receipt, result.receipt);
  }
  const current = s.load(); current.document.ingredients[0].name = 'Later edit';
  s.write({ kind: 'save', document: current.document, expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: 'later' });
  const reopened = createSqliteStorage(join(dir, 'data.db'), { now });
  try {
    assert.deepEqual(reopened.plans.applyAll([...ids].reverse(), review.consequencesFingerprint, 'invoice').receipt, result.receipt);
    assert.deepEqual(reopened.plans.apply(plans[0].id, plans[0].consequencesFingerprint).receipt, result.receipt);
    assert.equal(reopened.load().revision, 2);
    assert.throws(() => reopened.plans.applyAll([ids[0]], review.consequencesFingerprint, 'invoice'), { code: 'op-id-reused' });
    assert.throws(() => reopened.plans.applyAll(ids, 'different', 'invoice'), { code: 'op-id-reused' });
  } finally { reopened.close(); }
});

test('apply-all: failure after saving document and first applied mark rolls everything back', t => {
  const { s, ids } = fixture(t), review = s.plans.reviewAll(ids), before = rows(s);
  s.db.exec(`CREATE TRIGGER fail_second BEFORE UPDATE ON plans WHEN NEW.id='${[...ids].sort()[1]}' BEGIN SELECT RAISE(ABORT, 'full'); END`);
  assert.throws(() => s.plans.applyAll(ids, review.consequencesFingerprint, 'invoice'), { code: 'write-failed' });
  assert.deepEqual(rows(s), before);
  s.db.exec('DROP TRIGGER fail_second');
  assert.equal(apply(s, ids).revision, 1);
});

test('apply-all: invalid lists, duplicate ingredient, inactive/expired/stale plans and wrong fingerprint never write', t => {
  const { s, ids, advance } = fixture(t);
  for (const bad of [null, [], 'x', [ids[0], ids[0]], [1], Array(51).fill('x')]) {
    assert.throws(() => s.plans.reviewAll(bad), { code: 'invalid-argument' });
  }
  let before = rows(s);
  for (const token of [undefined, 'bad']) {
    assert.throws(() => s.plans.applyAll(ids, token, 'invoice'), { code: 'plan-consequences-changed', status: 409 });
    assert.deepEqual(rows(s), before);
  }
  assert.throws(() => s.plans.applyAll(ids, 'bad', ''), { code: 'invalid-argument' });
  // Isolated corruption fixture: two pending records for one ingredient must be refused explicitly.
  const duplicate = JSON.parse(s.db.prepare('SELECT plan FROM plans WHERE id=?').get(ids[0]).plan);
  duplicate.id = 'duplicate';
  s.db.prepare('INSERT INTO plans(id,expiresAt,plan) VALUES(?,?,?)').run(duplicate.id, duplicate.expiresAt, JSON.stringify(duplicate));
  before = rows(s);
  assert.throws(() => s.plans.applyAll([ids[0], duplicate.id], 'bad', 'invoice'), { code: 'plan-duplicate-ingredient' });
  assert.deepEqual(rows(s), before);
  advance(86400000);
  before = rows(s);
  assert.throws(() => s.plans.applyAll(ids, 'bad', 'invoice'), { code: 'plan-consequences-changed', status: 409 });
  assert.deepEqual(rows(s), before);
});

test('apply-all: any concurrent revision requires a fresh combined review; pending membership is checked', t => {
  for (const change of ['recipe', 'unrelated', 'single', 'own-price', 'superseded', 'rejected']) {
    const { s, ids, plans } = fixture(t), review = s.plans.reviewAll(ids);
    if (change === 'single') s.plans.apply(ids[0], plans[0].consequencesFingerprint);
    else if (change === 'superseded') s.plans.propose({ ingredient: 'i1', packPrice: '17', packSize: '1kg' });
    else if (change === 'rejected') s.plans.reject(ids[0]);
    else {
      const current = s.load();
      if (change === 'recipe') current.document.recipes[1].monthlyVolume = 50;
      if (change === 'unrelated') current.document.settings.defaultVatRateBp = 2100;
      if (change === 'own-price') current.document.ingredients[0].prices.push({ ...current.document.ingredients[0].prices[0], seq: 2 });
      s.write({ kind: 'save', document: current.document, expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: 'other' });
    }
    const before = rows(s);
    assert.throws(() => s.plans.applyAll(ids, review.consequencesFingerprint, 'invoice'), { code: 'plan-consequences-changed', status: 409 }, change);
    assert.deepEqual(rows(s), before);
    if (['recipe', 'unrelated'].includes(change)) assert.equal(apply(s, ids).revision, 2);
  }
});

test('apply-all HTTP: UI only, fingerprint/identity validation and concurrent single/batch operations', async t => {
  for (const batchFirst of [true, false]) {
    const { s, ids, plans, dir } = fixture(t);
    writeFileSync(join(dir, 'index.html'), '<head></head>');
    const server = await serveLocal({ storage: s, dataDir: dir, distDir: dir, port: 0 });
    try {
      const ui = (await signIn(server, dir)).token, cli = server.cliToken;
      const post = (route, body, token = ui, origin = server.address) => fetch(server.address + '/api/plans/' + route, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const reviewResponse = await post('review-all', { planIds: ids });
      assert.equal(reviewResponse.status, 200);
      const review = await reviewResponse.json();
      const body = { planIds: ids, consequencesFingerprint: review.consequencesFingerprint, opId: 'invoice' };
      for (const route of ['review-all', 'apply-all']) assert.equal((await post(route, body, cli)).status, 403);
      assert.equal((await post('apply-all', body, ui, 'https://elsewhere.invalid')).status, 403);
      assert.equal((await post('apply-all', { ...body, extra: true })).status, 400);
      const batch = () => post('apply-all', body);
      const single = () => post('apply', { id: ids[0], consequencesFingerprint: plans[0].consequencesFingerprint });
      const responses = await Promise.all(batchFirst ? [batch(), single()] : [single(), batch()]);
      assert.equal(responses[0].status, 200);
      assert.equal(responses[1].status, batchFirst ? 200 : 409);
      assert.equal(s.load().revision, 1);
      assert.deepEqual(s.load().document.ingredients.map(i => i.prices.length), batchFirst ? [2, 2] : [2, 1]);
      if (batchFirst) assert.deepEqual((await (await batch()).json()).receipt, (await responses[0].json()).receipt);
    } finally { await server.close(); }
  }
});

test('apply-all CLI: plans explains owner confirmation in EN/NL JSON and text', async t => {
  const { executePlanCommand, printPlan } = await import('../../server/cliPlans.js');
  const { s } = fixture(t);
  for (const locale of ['en', 'nl']) {
    const result = await executePlanCommand('plans', ['--locale', locale], async route => route === 'plans' ? s.plans.snapshot() : {});
    assert.match(result.confirmation, locale === 'nl' ? /Alles toepassen/ : /Apply all/);
    const output = []; t.mock.method(console, 'log', value => output.push(value));
    printPlan(result); t.mock.restoreAll();
    assert.ok(output.includes(result.confirmation));
  }
});

test('apply-all HTTP: a competing window revision conflicts even when displayed recipe effects stay equal', async t => {
  const { s, ids, dir } = fixture(t);
  const initial = s.load();
  s.write({ kind: 'save', document: initial.document, expectedDocumentId: null, expectedRevision: 0, opId: 'initial' });
  const review = s.plans.reviewAll(ids), current = s.load();
  writeFileSync(join(dir, 'index.html'), '<head></head>');
  const server = await serveLocal({ storage: s, dataDir: dir, distDir: dir, port: 0 });
  try {
    const token = (await signIn(server, dir)).token;
    const post = (path, body) => fetch(server.address + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: server.address, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    current.document.settings.defaultVatRateBp = 2100;
    const [edit, batch] = await Promise.all([
      post('/api/write', { kind: 'save', document: current.document, expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: 'other-window' }),
      post('/api/plans/apply-all', { planIds: ids, consequencesFingerprint: review.consequencesFingerprint, opId: 'invoice' })
    ]);
    assert.equal(edit.status, 200); assert.equal(batch.status, 409);
    assert.equal((await batch.json()).code, 'plan-consequences-changed');
    assert.equal(s.load().revision, 2);
    assert.deepEqual(s.load().document.ingredients.map(i => i.prices.length), [1, 1]);
    assert.deepEqual(s.plans.reviewAll(ids).effects, review.effects);
    assert.equal(apply(s, ids).revision, 3);
  } finally { await server.close(); }
});

test('apply-all: including a superseded and replacement plan for one ingredient is explicitly refused', t => {
  const { s, ids } = fixture(t);
  const replacement = s.plans.propose({ ingredient: 'i1', packPrice: '20', packSize: '1kg' });
  const before = rows(s);
  assert.throws(() => s.plans.applyAll([ids[0], replacement.id], 'bad', 'invoice'), { code: 'plan-duplicate-ingredient' });
  assert.deepEqual(rows(s), before);
});
