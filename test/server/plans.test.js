import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStorage } from '../../server/sqlite.js';
import { serveLocal } from '../../server/http.js';
import { signIn } from './session-helper.js';
import { smallDocument, dish, line, prep } from '../store/fixtures.js';
import { dashboardData } from '../../src/calc/dashboard.js';
const input = { ingredient: ' I1 ', packPrice: '18,00', packSize: '1 kg' };
function fixture(t, document = smallDocument()) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-plans-'));
  let time = Date.parse('2026-10-22T12:00:00Z');
  const s = createSqliteStorage(join(dir, 'data.db'), { initialDocument: document, now: () => time });
  s.backups = { list: () => [], status: () => ({ overdue: false, externalOverdue: false, backupError: null, externalError: null, corruptBackups: 0, corruptExternalBackups: 0, clockWarning: false }) };
  t.after(() => { s.close(); rmSync(dir, { recursive: true }); });
  return { s, dir, advance: ms => { time += ms; } };
}
test('plans: fixed normalized price, nested parity, no-volume exclusion, idempotent receipt and audit', t => {
  const doc = smallDocument(); doc.recipes[1].monthlyVolume = 123;
  doc.recipes.push(prep('p2', [line('l', 'prep', 'p1', 500000)]), prep('p3', [line('l', 'prep', 'p2', 500000)]));
  doc.recipes[1].lines = [line('l', 'prep', 'p3', 500000)];
  doc.recipes.push(dish('no-volume', [line('l', 'prep', 'p1', 300000)]));
  const { s } = fixture(t, doc), before = s.load();
  assert.ok(s.plans, 'plans service must exist');
  const plan = s.plans.propose(input);
  assert.equal(plan.status, 'pending'); assert.equal(plan.price.packPriceCents, '1800');
  assert.equal(plan.price.packSizeMilli, 1000000); assert.equal(plan.price.seq, 2);
  assert.deepEqual(s.load(), before);
  const result = s.plans.apply(plan.id);
  const price = result.document.ingredients[0].prices.at(-1);
  assert.equal(price.recordedAt, plan.price.recordedAt);
  assert.equal(result.revision, 1);
  const dashboard = dashboardData(result.document, '2026-10-22T11:59:59.999Z');
  assert.equal(plan.effects.totalMonthlyImpactCents, String(dashboard.totalMonthlyImpactCents));
  for (const row of dashboard.dishes) {
    const effect = plan.effects.dishes.find(d => d.id === row.id);
    for (const key of ['currentCostMicro', 'comparisonCostMicro', 'foodCostDeltaTenthsPct', 'monthlyImpactCents']) assert.equal(effect[key], row[key] === null ? null : String(row[key]));
  }
  assert.equal(plan.effects.preps[0].currentBatchMicro, String(dashboard.preps[0].currentBatchMicro));
  assert.equal(plan.effects.dishes.find(d => d.id === 'no-volume').monthlyImpactCents, null);
  assert.equal(plan.effects.dishes.find(d => d.id === 'no-volume').excludedReason, 'no-volume');
  assert.equal(plan.effects.dishes.find(d => d.id === doc.recipes[1].id).excludedReason, null);
  assert.deepEqual(s.plans.apply(plan.id).receipt, result.receipt);
  assert.equal(s.load().revision, 1);
  assert.equal(s.plans.get(plan.id).status, 'applied');
  assert.equal(s.journal.list()[0].source, 'agent'); assert.equal(s.journal.list()[0].confirmedBy, 'ui');
});
test('plans: stale identity/revision, expiry and rejection never append a price', t => {
  for (const mode of ['revision', 'identity', 'expiry', 'reject']) {
    const { s, advance } = fixture(t);
    const initial = s.load(); s.write({ kind: 'save', document: initial.document, expectedDocumentId: null, expectedRevision: 0, opId: 'initial' });
    const plan = s.plans.propose(input);
    if (mode === 'revision' || mode === 'identity') {
      const record = s.load(); record[mode === 'revision' ? 'revision' : 'documentId'] = mode === 'revision' ? 2 : 'other';
      s.db.prepare('UPDATE document SET record=? WHERE id=1').run(JSON.stringify(record));
    }
    if (mode === 'expiry') advance(86400000);
    if (mode === 'reject') assert.equal(s.plans.reject(plan.id).status, 'rejected');
    const before = s.load();
    assert.throws(() => s.plans.apply(plan.id), { code: mode === 'expiry' ? 'plan-expired' : mode === 'reject' ? 'plan-rejected' : 'plan-stale' });
    assert.deepEqual(s.load(), before);
    assert.equal(s.plans.get(plan.id).status, mode === 'expiry' ? 'expired' : mode === 'reject' ? 'rejected' : 'stale');
  }
});
test('plans: rollback includes receipt, revision, history and applied mark, even a failure at final plan update', t => {
  const { s } = fixture(t), plan = s.plans.propose(input), before = s.load();
  s.db.exec("CREATE TRIGGER fail_plan BEFORE UPDATE ON plans BEGIN SELECT RAISE(ABORT, 'full'); END");
  assert.throws(() => s.plans.apply(plan.id), { code: 'write-failed' });
  assert.deepEqual(s.load(), before); assert.equal(s.plans.get(plan.id).status, 'pending');
  for (const table of ['ops', 'journal', 'history']) assert.equal(s.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  s.db.exec('DROP TRIGGER fail_plan'); assert.equal(s.plans.apply(plan.id).revision, 1);
});
test('plans: exact lookup, compatible units, comma, zero, negative and unsafe price', t => {
  const doc = smallDocument(); doc.ingredients[0].name = 'Café'; doc.ingredients[1].name = 'Café';
  const { s } = fixture(t, doc);
  assert.throws(() => s.plans.propose({ ...input, ingredient: 'Cafe\u0301' }), e => e.code === 'ambiguous' && e.candidates.length === 2);
  assert.throws(() => s.plans.propose({ ...input, ingredient: 'Caf' }), e => e.code === 'not-found' && e.candidates.length > 0);
  assert.throws(() => s.plans.propose({ ...input, packSize: '1 l' }), { code: 'invalid-unit' });
  for (const packPrice of ['-1', '90071992547409.92', 'NaN', '1.001']) assert.throws(() => s.plans.propose({ ...input, packPrice }), { code: 'invalid-argument' });
  assert.equal(s.plans.propose({ ...input, packPrice: '0' }).price.packPriceCents, '0');
});
test('plans: unknown is not zero; pending count budget and cleanup', t => {
  const doc = smallDocument(); doc.ingredients[0].prices = []; doc.recipes[1].monthlyVolume = 100;
  for (let i = 1; i < 51; i++) doc.ingredients.push({ ...doc.ingredients[0], id: 'extra' + i, name: 'Extra ' + i });
  const { s, advance } = fixture(t, doc), p = s.plans.propose(input);
  assert.equal(p.effects.dishes[0].comparisonCostMicro, null);
  assert.equal(p.effects.dishes[0].monthlyImpactCents, null);
  assert.equal(p.effects.dishes[0].excludedReason, 'cost-unknown');
  for (let i = 1; i < 50; i++) s.plans.propose({ ...input, ingredient: 'extra' + i });
  assert.throws(() => s.plans.propose({ ...input, ingredient: 'extra50' }), { code: 'plan-budget' });
  advance(86400000); assert.equal(s.plans.get(p.id).status, 'expired');
  assert.equal(s.plans.propose(input).status, 'pending');
  advance(8 * 86400000); assert.equal(s.plans.list().length, 1);
});
test('plans HTTP: CLI cannot approve/reject even with Origin; UI requires correct Origin', async t => {
  const { s, dir } = fixture(t);
  writeFileSync(join(dir, 'index.html'), '<html><head></head><body></body></html>');
  const server = await serveLocal({ storage: s, dataDir: dir, distDir: dir, port: 0 });
  const ui = (await signIn(server, dir)).token;
  try {
    const plan = s.plans.propose(input);
    for (const action of ['apply', 'reject']) for (const [token, origin, code] of [[server.cliToken, undefined, 'ui-required'], [server.cliToken, server.address, 'ui-required'], [ui, undefined, 'origin'], [ui, 'https://evil.example', 'origin']]) {
      const res = await fetch(server.address + '/api/plans/' + action, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(origin && { Origin: origin }) }, body: JSON.stringify({ id: plan.id }) });
      assert.equal(res.status, 403); assert.equal((await res.json()).code, code);
    }
    assert.equal(s.plans.get(plan.id).status, 'pending');
    const res = await fetch(server.address + '/api/plans/apply', { method: 'POST', headers: { Authorization: `Bearer ${ui}`, Origin: server.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: plan.id }) });
    assert.equal(res.status, 200);
  } finally { await server.close(); }
});

test('plans CLI: propose comma price, read status/list, human confirmation and candidates', async t => {
  const { s, dir } = fixture(t);
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  writeFileSync(join(dir, 'index.html'), '<html><head></head><body></body></html>');
  const server = await serveLocal({ storage: s, dataDir: dir, distDir: dir, port: 0, instanceId: 'cli-plans' });
  writeFileSync(join(dir, 'lock'), JSON.stringify({ address: server.address, instanceId: 'cli-plans' }));
  writeFileSync(join(dir, 'token'), server.cliToken, { mode: 0o600 });
  const cli = args => exec(process.execPath, ['server/cli.js', ...args], { env: { ...process.env, MENUPILOT_DATA_DIR: dir } });
  try {
    const { stdout } = await cli(['propose', 'add-price', '--ingredient', 'i1', '--pack-price', '18,00', '--pack-size', '1', 'kg', '--json']);
    const result = JSON.parse(stdout); assert.equal(result.apiVersion, 1); assert.deepEqual(result.data.price.packPriceCents, { cents: '1800', display: '€18.00' });
    assert.equal(result.data.proposedPrice.unitPrice.display, '€18.00');
    const status = JSON.parse((await cli(['plan', 'status', result.data.id, '--json'])).stdout); assert.equal(status.data.status, 'pending');
    assert.equal(JSON.parse((await cli(['plans', '--json'])).stdout).data.length, 1);
    assert.match((await cli(['propose', 'add-price', '--ingredient', 'i1', '--pack-price', '19', '--pack-size', '1 kg'])).stdout, /Waiting for owner confirmation in MenuPilot/);
    await assert.rejects(cli(['propose', 'add-price', '--ingredient', 'missing', '--pack-price', '18', '--pack-size', '1 kg', '--json']), e => e.code === 4 && JSON.parse(e.stderr).error.candidates.length === 2);
    const nl = (await cli(['propose', 'add-price', '--ingredient', 'i1', '--pack-price', '20', '--pack-size', '2,5kg', '--locale', 'nl'])).stdout;
    assert.doesNotMatch(nl, /food cost|excluded:|without volume|with unknown cost|no-volume/);
    assert.match(nl, /Foodcostpercentage/); assert.match(nl, /uitgesloten: zonder maandvolume/);
    assert.match(nl, /€\s5,00\/kg → €\s8,00\/kg/);
    assert.match(nl, /2,5 kg/); assert.match(nl, /€\s8,00\/kg/); assert.match(nl, /Wacht op bevestiging/);
    await assert.rejects(cli(['plan', 'apply', result.data.id, '--json']), e => e.code === 2);
  } finally { await server.close(); }
});

test('plans: byte budgets refuse oversized effects and pending total; terminal retention is bounded', async t => {
  const { PLAN_LIMITS } = await import('../../server/plans.js');
  const { s } = fixture(t);
  const original = { ...PLAN_LIMITS };
  try {
    PLAN_LIMITS.singleBytes = 10;
    assert.throws(() => s.plans.propose(input), { code: 'plan-budget' });
    assert.equal(s.plans.list().length, 0);
    PLAN_LIMITS.singleBytes = original.singleBytes;
    const p = s.plans.propose(input);
    PLAN_LIMITS.bytes = Buffer.byteLength(JSON.stringify(p)) + 10;
    assert.throws(() => s.plans.propose(input), { code: 'plan-budget' });
    assert.equal(s.plans.list().length, 1);
    assert.equal(s.plans.get(p.id).status, 'pending');
    PLAN_LIMITS.bytes = original.bytes; PLAN_LIMITS.count = 3;
    s.plans.reject(p.id);
    for (let i = 0; i < 5; i++) s.plans.reject(s.plans.propose(input).id);
    assert.equal(s.plans.list().length, 3);
  } finally { Object.assign(PLAN_LIMITS, original); }
});

test('plans: original receipt survives later write and database reopen', t => {
  const { s, dir } = fixture(t), p = s.plans.propose(input), applied = s.plans.apply(p.id);
  const next = structuredClone(applied.document); next.ingredients[1].name = 'new name';
  s.write({ kind: 'save', document: next, expectedDocumentId: applied.documentId, expectedRevision: applied.revision, opId: 'later' });
  const reopened = createSqliteStorage(join(dir, 'data.db'));
  try {
    const replay = reopened.plans.apply(p.id);
    assert.deepEqual(replay.receipt, applied.receipt); assert.equal(replay.revision, 2);
    assert.equal(replay.document.ingredients[0].prices.length, 2);
  } finally { reopened.close(); }
});

test('plans: replacement, price guardrails and delayed apply preserve the proposal timestamp', t => {
  const { s, advance } = fixture(t);
  const a = s.plans.propose(input);
  const b = s.plans.propose({ ...input, packPrice: '100000', packSize: '1kg' });
  assert.equal(s.plans.get(a.id).status, 'superseded');
  assert.deepEqual(b.supersedes, [a.id]);
  assert.deepEqual(b.warnings.map(w => w.code), ['large-price-change']);
  assert.throws(() => s.plans.propose({ ...input, packPrice: '100000.01' }), { code: 'price-limit' });
  assert.equal(s.plans.get(b.id).status, 'pending');
  advance(3600000);
  const applied = s.plans.apply(b.id);
  assert.equal(applied.document.ingredients[0].prices.at(-1).recordedAt, b.price.recordedAt);
  assert.equal(s.journal.list()[0].planId, b.id);
  assert.equal(s.journal.list()[0].ingredientId, b.ingredient.id);
  const zero = s.plans.propose({ ...input, packPrice: '0' });
  assert.ok(zero.warnings.some(w => w.code === 'zero-price'));
  const low = s.plans.propose({ ...input, packPrice: '0.01' });
  assert.ok(low.warnings.some(w => w.code === 'large-price-change'));
});
test('plans: reject is idempotent only for rejected plans and cannot change applied/stale/expired', t => {
  for (const state of ['applied', 'stale', 'expired', 'rejected']) {
    const { s, advance } = fixture(t), p = s.plans.propose(input);
    if (state === 'applied') s.plans.apply(p.id);
    if (state === 'stale') { const c = s.load(); s.write({ kind: 'save', document: c.document, expectedDocumentId: c.documentId, expectedRevision: c.revision, opId: 'change' }); }
    if (state === 'expired') advance(86400000);
    if (state === 'rejected') { const first = s.plans.reject(p.id); assert.deepEqual(s.plans.reject(p.id), first); }
    else assert.throws(() => s.plans.reject(p.id), { code: 'plan-' + state });
    assert.equal(s.plans.get(p.id).status, state);
  }
});

test('plans HTTP: stale/expired return conflict and listing carries its version', async t => {
  const { s, dir, advance } = fixture(t);
  writeFileSync(join(dir, 'index.html'), '<head></head>');
  const server = await serveLocal({ storage: s, dataDir: dir, distDir: dir, port: 0 });
  try {
    const ui = (await signIn(server, dir)).token;
    const headers = { Authorization: `Bearer ${ui}`, Origin: server.address, 'Content-Type': 'application/json' };
    for (const mode of ['stale', 'expired']) {
      const p = s.plans.propose(input);
      if (mode === 'expired') advance(86400000);
      else { const c = s.load(); s.write({ kind: 'save', document: c.document, expectedDocumentId: c.documentId, expectedRevision: c.revision, opId: 'change' }); }
      for (const action of ['apply', 'reject']) {
        const r = await fetch(server.address + '/api/plans/' + action, { method: 'POST', headers, body: JSON.stringify({ id: p.id }) });
        assert.equal(r.status, 409); assert.equal((await r.json()).code, 'plan-' + mode);
      }
    }
    const listing = await (await fetch(server.address + '/api/plans', { headers })).json();
    assert.deepEqual({ documentId: listing.documentId, revision: listing.revision }, s.version());
    assert.equal(listing.plans.length, 2);
  } finally { await server.close(); }
});

test('plans: exact ratio guardrail accounts for both pack sizes and strict ×3 boundary', t => {
  const { s } = fixture(t);
  for (const [packPrice, packSize, warn] of [['15', '1kg', false], ['15.01', '1kg', true], ['3.34', '2kg', false], ['3.33', '2kg', true], ['10', '2kg', false]]) {
    const p = s.plans.propose({ ...input, packPrice, packSize });
    assert.equal(p.warnings.some(w => w.code === 'large-price-change'), warn);
  }
});
test('plans CLI: all money fields follow D4 and list version comes from the same response', async t => {
  const { executePlanCommand } = await import('../../server/cliPlans.js');
  const { s } = fixture(t), p = s.plans.propose(input);
  for (const [command, args] of [['plans', []], ['plan', ['status', p.id]], ['propose', ['add-price', '--ingredient', 'i1', '--pack-price', '18', '--pack-size', '1kg']]]) {
    const calls = [];
    const result = await executePlanCommand(command, [...args, '--locale', 'nl'], async route => { calls.push(route); return route === 'plans' ? { documentId: 'snapshot', revision: 42, plans: [p] } : p; });
    assert.deepEqual(calls, command === 'plans' ? ['plans', 'backups/status'] : command === 'plan' ? ['plans/status', 'backups/status'] : ['plans/propose', 'backups/status']);
    if (command === 'plans') { assert.equal(result.documentId, 'snapshot'); assert.equal(result.revision, 42); }
    const plan = Array.isArray(result.data) ? result.data[0] : result.data;
    function check(value) {
      if (!value || typeof value !== 'object') return;
      for (const [k, v] of Object.entries(value)) {
        if (/(Cents|Micro)$/.test(k) && v !== null) {
          assert.match(v[k.endsWith('Micro') ? 'micro' : 'cents'], /^-?\d+$/);
          assert.match(v.display, /€/); assert.match(v.display, /,/);
        } else check(v);
      }
    }
    check(plan); assert.match(plan.proposedPrice.unitPrice.display, /€/);
    assert.ok(result.warnings[0].message.includes('verandert'));
  }
});
