import { encoded, decoded } from './fixtures.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPriceAtDate } from '../../src/calc/costing.js';
import { DEMO_REFERENCE_NOW } from '../../src/store/demo.js';
import { STORAGE_KEY, StoreError, createStore } from '../../src/store/store.js';
import { emptyDocument, validateDocument } from '../../src/store/schema.js';
import {
  clone, daysBefore, deepFreeze, dish, line, makeScenario, memoryStorage, prep, quotaError, readDemo, smallDocument,
} from './fixtures.js';

const NOW = '2026-11-01T10:00:00.000Z';

function newStore(storage = memoryStorage(), options = {}) {
  return createStore(storage, { now: () => NOW, demo: readDemo(), ...options });
}

async function seeded(doc = smallDocument(), options = {}) {
  const storage = memoryStorage({ [STORAGE_KEY]: encoded(doc) });
  const store = newStore(storage, options);
  (await store.load());
  return { storage, store };
}

async function assertStoreError(fn, code, pattern) {
  (await assert.rejects(async () => fn(), (error) => {
    assert.ok(error instanceof StoreError, `not a StoreError: ${error}`);
    assert.equal(error.code, code, error.message);
    if (pattern) assert.match(error.message, pattern);
    return true;
  }));
}

test('storage key is menupilot:v1', () => {
  assert.equal(STORAGE_KEY, 'menupilot:v1');
});

test('first run loads the demo, shifted to now, without writing storage', async () => {
  const storage = memoryStorage();
  const store = newStore(storage);
  const doc = (await store.load());
  assert.deepEqual(validateDocument(doc).errors, []);
  assert.equal(doc.recipes.find((r) => r.name === 'Classic Burger').monthlyVolume, 300);
  const last = doc.ingredients[0].prices.at(-1).recordedAt;
  const shift = Date.parse(NOW) - Date.parse(DEMO_REFERENCE_NOW);
  assert.equal(last, new Date(Date.parse(readDemo().ingredients[0].prices.at(-1).recordedAt) + shift).toISOString());
  assert.equal(storage.data.size, 0);
  assert.equal(store.getDocument(), doc);
});

test('data survives a restart (new store on the same storage)', async () => {
  const storage = memoryStorage();
  const first = newStore(storage);
  (await first.load());
  const { id } = (await first.addIngredient({ name: 'Basil', unit: 'g' }));
  (await first.addPrice(id, { packPriceCents: 250, packSizeMilli: 100_000 }));
  const saved = (await first.saveRecipe({ ...dish('', []), id: 'dish-x', name: 'Pesto toast' }));
  (await first.saveScenario(makeScenario(saved.document, 'dish-x')));

  const second = newStore(storage);
  const reloaded = (await second.load());
  assert.deepEqual(reloaded, first.getDocument());
  assert.equal(reloaded.ingredients.find((i) => i.id === id).prices[0].packSizeMilli, 100_000);
  assert.equal(reloaded.scenarios.length, 1);
});

test('broken JSON: error, storage untouched, nothing can overwrite it', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{"version": 1, ' });
  const store = newStore(storage);
  (await assertStoreError(async () => (await store.load()), 'corrupt-json', /not valid JSON/));
  (await assertStoreError(async () => (await store.addIngredient({ name: 'X', unit: 'g' })), 'not-loaded'));
  assert.equal(storage.data.get(STORAGE_KEY), '{"version": 1, ');
  assert.equal(store.readRaw(), '{"version": 1, ');
});

test('unsupported version and invalid stored data: error, storage untouched', async () => {
  const future = JSON.stringify({ ...smallDocument(), version: 3 });
  const storage = memoryStorage({ [STORAGE_KEY]: future });
  (await assertStoreError(async () => (await newStore(storage).load()), 'unsupported-version', /version 3.*versions 1 and 2/));
  assert.equal(storage.data.get(STORAGE_KEY), future);

  const broken = smallDocument();
  broken.recipes[0].lines[0].ref.id = 'ghost';
  const raw = JSON.stringify(broken);
  const storage2 = memoryStorage({ [STORAGE_KEY]: raw });
  (await assertStoreError(async () => (await newStore(storage2).load()), 'invalid', /ghost/));
  assert.equal(storage2.data.get(STORAGE_KEY), raw);

  const storage3 = memoryStorage({ [STORAGE_KEY]: '[1,2]' });
  (await assertStoreError(async () => (await newStore(storage3).load()), 'invalid'));
});

test('resetToDemo is the explicit way out of a broken state', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: 'garbage' });
  const store = newStore(storage);
  (await assertStoreError(async () => (await store.load()), 'corrupt-json'));
  const doc = (await store.resetToDemo());
  assert.deepEqual(validateDocument(doc).errors, []);
  assert.deepEqual(decoded(storage.data.get(STORAGE_KEY)), doc);
  assert.deepEqual((await newStore(storage).load()), doc);
});

test('resetToEmpty replaces everything with a valid empty document and writes it', async () => {
  const { storage, store } = (await seeded());
  const before = store.getDocument();
  assert.ok(before.ingredients.length > 0);
  const doc = (await store.resetToEmpty());
  assert.deepEqual(doc, emptyDocument());
  assert.deepEqual(validateDocument(doc).errors, []);
  assert.ok(Object.isFrozen(doc));
  assert.equal(store.getDocument(), doc);
  assert.deepEqual(decoded(storage.data.get(STORAGE_KEY)), emptyDocument());
  assert.deepEqual((await newStore(storage).load()), emptyDocument());
  assert.ok(before.ingredients.length > 0, 'the earlier document is not changed in place');
});

test('resetToEmpty is also a way out of a broken state', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: 'garbage' });
  const store = newStore(storage);
  (await assertStoreError(async () => (await store.load()), 'corrupt-json'));
  assert.deepEqual((await store.resetToEmpty()), emptyDocument());
  assert.deepEqual((await newStore(storage).load()), emptyDocument());
});

test('resetToEmpty is atomic: a write failure leaves memory and storage as they were', async () => {
  const { storage, store } = (await seeded());
  const before = store.getDocument();
  const rawBefore = storage.data.get(STORAGE_KEY);
  storage.failOnSet = quotaError();
  (await assertStoreError(async () => (await store.resetToEmpty()), 'quota'));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.data.get(STORAGE_KEY), rawBefore);
});

test('write failure (quota): clear error, memory and storage stay as before', async () => {
  const { storage, store } = (await seeded());
  const before = store.getDocument();
  const rawBefore = storage.data.get(STORAGE_KEY);
  storage.failOnSet = quotaError();
  (await assertStoreError(async () => (await store.addPrice('i1', { packPriceCents: 900, packSizeMilli: 1_000_000 })), 'quota', /storage is full/i));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.data.get(STORAGE_KEY), rawBefore);

  storage.failOnSet = new Error('disk on fire');
  (await assertStoreError(async () => (await store.deleteIngredient('i2')), 'write-failed', /could not be saved/i));
  assert.equal(store.getDocument(), before);

  storage.failOnSet = null;
  (await store.deleteIngredient('i2'));
  assert.equal(store.getDocument().ingredients.length, 1);
});

test('addPrice only appends: seq = max + 1, recordedAt = now(), old records unchanged', async () => {
  const { store } = (await seeded());
  const before = store.getDocument();
  const doc = (await store.addPrice('i1', { packPriceCents: 650, packSizeMilli: 500_000 }));
  const prices = doc.ingredients[0].prices;
  assert.equal(prices.length, 2);
  assert.deepEqual(prices[0], before.ingredients[0].prices[0]);
  assert.deepEqual(prices[1], { seq: 2, recordedAt: NOW, packPriceCents: 650, packSizeMilli: 500_000 });
  assert.equal(before.ingredients[0].prices.length, 1);

  const third = (await store.addPrice('i1', { packPriceCents: 700, packSizeMilli: 500_000 }));
  assert.deepEqual(third.ingredients[0].prices.map((p) => p.seq), [1, 2, 3]);
  assert.equal((await store.addPrice('i2', { packPriceCents: 1, packSizeMilli: 1 })).ingredients[1].prices.at(-1).seq, 2);
});

test('price at a date is chosen by recordedAt; pack size is a snapshot per price', async () => {
  let clock = '2026-02-01T00:00:00.000Z';
  const { store } = (await seeded(smallDocument(), { now: () => clock }));
  (await store.addPrice('i1', { packPriceCents: 600, packSizeMilli: 2_000_000 }));
  clock = '2026-03-01T00:00:00.000Z';
  const doc = (await store.addPrice('i1', { packPriceCents: 800, packSizeMilli: 1_000_000 }));
  const { prices } = doc.ingredients[0];
  assert.equal(selectPriceAtDate(prices, '2026-02-15T00:00:00.000Z').packPriceCents, 600);
  assert.equal(selectPriceAtDate(prices, '2026-02-15T00:00:00.000Z').packSizeMilli, 2_000_000);
  assert.equal(selectPriceAtDate(prices, '2026-01-15T00:00:00.000Z').packPriceCents, 500);
  assert.equal(selectPriceAtDate(prices).packPriceCents, 800);
});

test('addPrice keeps history ordered even if the clock moved backwards; rejects bad input', async () => {
  const { store } = (await seeded(smallDocument(), { now: () => '2025-01-01T00:00:00.000Z' }));
  const doc = (await store.addPrice('i1', { packPriceCents: 650, packSizeMilli: 1000 }));
  assert.equal(doc.ingredients[0].prices[1].recordedAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(validateDocument(doc).errors, []);

  const before = store.getDocument();
  (await assertStoreError(async () => (await store.addPrice('i1', { packPriceCents: -5, packSizeMilli: 1000 })), 'invalid', /packPriceCents/));
  (await assertStoreError(async () => (await store.addPrice('i1', { packPriceCents: 5, packSizeMilli: 0 })), 'invalid', /packSizeMilli/));
  (await assertStoreError(async () => (await store.addPrice('i1', { packPriceCents: 5.5, packSizeMilli: 10 })), 'invalid', /packPriceCents/));
  (await assertStoreError(async () => (await store.addPrice('nope', { packPriceCents: 5, packSizeMilli: 10 })), 'not-found', /nope/));
  assert.equal(store.getDocument(), before);
});

test('cannot delete a used ingredient or prep; unused ones are deleted', async () => {
  const { store } = (await seeded());
  const before = store.getDocument();
  (await assertStoreError(async () => (await store.deleteIngredient('i1')), 'in-use', /used by.*p1/));
  (await assertStoreError(async () => (await store.deleteRecipe('p1')), 'in-use', /used by.*d1/));
  assert.equal(store.getDocument(), before);

  assert.equal((await store.deleteIngredient('i2')).ingredients.some((i) => i.id === 'i2'), false);
  (await store.deleteRecipe('d1'));
  assert.equal((await store.deleteRecipe('p1')).recipes.length, 0);
  assert.equal((await store.deleteIngredient('i1')).ingredients.length, 0);
  (await assertStoreError(async () => (await store.deleteRecipe('d1')), 'not-found'));
});

test('cannot change the output unit of a prep used by any recipe', async () => {
  const { storage, store } = (await seeded());
  const before = store.getDocument();
  const raw = storage.data.get(STORAGE_KEY);
  const usedPrep = before.recipes.find((recipe) => recipe.id === 'p1');

  (await assertStoreError(
    async () => (await store.saveRecipe({ ...usedPrep, outputUnit: 'ml' })),
    'in-use',
    /cannot change.*output unit.*used by.*d1/i,
  ));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.data.get(STORAGE_KEY), raw);

  // Same measurement family unit is exactly the same stored base unit; unused preps may change.
  const renamed = (await store.saveRecipe({ ...usedPrep, name: 'Renamed prep' }));
  assert.equal(renamed.document.recipes[0].name, 'Renamed prep');
  const unused = { ...usedPrep, id: 'p2', outputUnit: 'g' };
  (await store.saveRecipe(unused));
  const changedUnused = (await store.saveRecipe({ ...unused, outputUnit: 'ml' }));
  assert.equal(
    changedUnused.document.recipes.find((recipe) => recipe.id === 'p2').outputUnit,
    'ml',
  );
});

test('deleting a dish with scenarios is refused unless deleteScenarios is set', async () => {
  const base = smallDocument();
  base.scenarios = [makeScenario(base, 'd1', {}, 'sc1'), { ...makeScenario(base, 'd1', {}, 'sc2'), name: 'Second' }];
  const { storage, store } = (await seeded(base));
  const before = store.getDocument();
  const raw = storage.data.get(STORAGE_KEY);
  (await assert.rejects(async () => (await store.deleteRecipe('d1')), (error) => {
    assert.ok(error instanceof StoreError);
    assert.equal(error.code, 'in-use');
    assert.deepEqual(error.details, ['Cheaper beef', 'Second']);
    assert.match(error.message, /scenarios.*Cheaper beef, Second/);
    return true;
  }));
  (await assert.rejects(async () => (await store.deleteRecipe('d1', { deleteScenarios: false })), (error) => error.code === 'in-use'));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.data.get(STORAGE_KEY), raw);

  const after = (await store.deleteRecipe('d1', { deleteScenarios: true }));
  assert.equal(after.scenarios.length, 0);
  assert.equal(after.recipes.some((r) => r.id === 'd1'), false);
});

test('a dish without scenarios is deleted normally; other scenarios survive', async () => {
  const base = smallDocument();
  base.recipes.push(dish('d2', [line('l1', 'ingredient', 'i2')]));
  base.scenarios = [makeScenario(base, 'd1')];
  const { store } = (await seeded(base));
  const after = (await store.deleteRecipe('d2'));
  assert.equal(after.scenarios.length, 1);
});

test('demo is a required option and must be valid (fail fast)', async () => {
  (await assertStoreError(() => createStore(memoryStorage()), 'bad-options', /demo/));
  (await assertStoreError(() => createStore(memoryStorage(), { demo: null }), 'bad-options', /demo/));
  (await assertStoreError(() => createStore(memoryStorage(), { demo: { version: 1 } }), 'invalid'));
  (await assertStoreError(() => createStore(null, { demo: readDemo() }), 'bad-options', /storage/));
});

test('import and save reject price records from the future; tolerance is 5 minutes', async () => {
  const { storage, store } = (await seeded());
  const before = store.getDocument();
  const raw = storage.data.get(STORAGE_KEY);
  const withFuture = (recordedAt) => {
    const doc = smallDocument();
    doc.ingredients[0].prices[0].recordedAt = recordedAt;
    return doc;
  };
  const future = withFuture('2026-11-01T10:05:01.000Z');
  (await assertStoreError(async () => (await store.importJSON(JSON.stringify(future))), 'invalid', /recordedAt.*future/));
  (await assertStoreError(async () => (await store.save(future)), 'invalid', /recordedAt.*future/));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.data.get(STORAGE_KEY), raw);
  (await assert.doesNotReject(async () => (await store.importJSON(JSON.stringify(withFuture('2026-11-01T10:05:00.000Z'))))));
});

test('import larger than the size limit is refused', async () => {
  const { store } = (await seeded());
  const before = store.getDocument();
  (await assertStoreError(async () => (await store.importJSON(' '.repeat(5_000_001))), 'invalid', /too large/i));
  assert.equal(store.getDocument(), before);
});

test('a stored document with a slightly-future price still loads and can be edited', async () => {
  const doc = smallDocument();
  doc.ingredients[0].prices[0].recordedAt = '2026-11-01T11:00:00.000Z';
  const { store } = (await seeded(doc));
  const next = (await store.updateIngredient('i1', { name: 'Renamed' }));
  assert.equal(next.ingredients[0].name, 'Renamed');
  const priced = (await store.addPrice('i1', { packPriceCents: 1, packSizeMilli: 1 }));
  assert.equal(priced.ingredients[0].prices[1].recordedAt, '2026-11-01T11:00:00.000Z');
});

test('saveRecipe rejects cycles, self reference, depth 6, dish-as-prep and kind mismatch', async () => {
  const { store } = (await seeded());
  const before = store.getDocument();
  const attempts = [
    [prep('p1', [line('l1', 'prep', 'p1')]), /cycle/i],
    [prep('p1', [line('l1', 'prep', 'p2')]), /unknown prep/i],
    [dish('d2', [line('l1', 'prep', 'd1')]), /dish.*cannot be used as a prep/i],
    [dish('d2', [line('l1', 'ingredient', 'p1')]), /unknown ingredient.*recipe/i],
    [dish('d2', [line('l1', 'prep', 'i1')]), /unknown prep/i],
  ];
  for (const [recipe, pattern] of attempts) {
    (await assertStoreError(async () => (await store.saveRecipe(recipe)), 'invalid', pattern));
  }
  // A->B->A cycle through two preps
  (await store.saveRecipe(prep('pa', [line('l1', 'ingredient', 'i1')])));
  (await store.saveRecipe(prep('pb', [line('l1', 'prep', 'pa')])));
  (await assertStoreError(async () => (await store.saveRecipe(prep('pa', [line('l1', 'prep', 'pb')]))), 'invalid', /cycle.*pa -> pb -> pa/i));
  // changing a referenced prep into a dish breaks the kind of the reference
  (await assertStoreError(async () => (await store.saveRecipe(dish('pa', []))), 'invalid'));
  assert.deepEqual(store.getDocument().recipes.map((r) => r.id), ['p1', 'd1', 'pa', 'pb']);
  assert.notEqual(store.getDocument(), before);

  // depth: p1 <- pb(2) <- ... build up to 5 prep levels, the 6th is rejected
  let top = 'pb';
  for (let level = 3; level <= 5; level += 1) {
    (await store.saveRecipe(prep(`q${level}`, [line('l1', 'prep', top)])));
    top = `q${level}`;
  }
  (await assertStoreError(async () => (await store.saveRecipe(prep('q6', [line('l1', 'prep', top)]))), 'invalid', /depth/i));
});

test('saveRecipe inserts or replaces; ids are generated when missing', async () => {
  const { store } = (await seeded(smallDocument(), { createId: (prefix) => `${prefix}_gen1` }));
  const created = (await store.saveRecipe({ ...dish('x', []), id: undefined, name: 'New dish' }));
  assert.equal(created.id, 'rcp_gen1');
  assert.equal(created.document.recipes.at(-1).name, 'New dish');
  const replaced = (await store.saveRecipe({ ...created.document.recipes.at(-1), name: 'Renamed' }));
  assert.equal(replaced.document.recipes.length, 3);
  assert.equal(replaced.document.recipes.at(-1).name, 'Renamed');
});

test('ingredient create/update rules', async () => {
  let counter = 0;
  const { store } = (await seeded(smallDocument(), { createId: (prefix) => `${prefix}_${counter ? 'other' : 'new'}${counter++}` }));
  const created = (await store.addIngredient({ name: 'Salt', unit: 'g', price: { packPriceCents: 80, packSizeMilli: 1_000_000 } }));
  assert.equal(created.id, 'ing_new0');
  assert.deepEqual(created.document.ingredients.at(-1).prices, [
    { seq: 1, recordedAt: NOW, packPriceCents: 80, packSizeMilli: 1_000_000 },
  ]);
  assert.equal((await store.updateIngredient('ing_new0', { name: 'Sea salt' })).ingredients.at(-1).name, 'Sea salt');
  (await assertStoreError(async () => (await store.updateIngredient('ing_new0', { unit: 'ml' })), 'invalid', /unit/i));
  (await assertStoreError(async () => (await store.updateIngredient('i1', { unit: 'ml' })), 'invalid', /unit/i));
  (await assertStoreError(async () => (await store.addIngredient({ name: '', unit: 'g' })), 'invalid', /name/));
  (await assertStoreError(async () => (await store.addIngredient({ name: 'Water', unit: 'kg' })), 'invalid', /unit/));
  assert.equal((await store.addIngredient({ name: 'Water', unit: 'ml' })).document.ingredients.at(-1).prices.length, 0);
});

test('scenarios: save, replace, delete; they are validated like the rest', async () => {
  const { store } = (await seeded());
  const scenario = makeScenario(store.getDocument(), 'd1', { menuPriceInclVatCents: 1500 });
  assert.equal((await store.saveScenario(scenario)).document.scenarios.length, 1);
  assert.equal((await store.saveScenario({ ...scenario, name: 'Renamed' })).document.scenarios[0].name, 'Renamed');
  (await assertStoreError(async () => (await store.saveScenario({ ...scenario, id: 's2', overrides: { monthlyVolume: -1 } })), 'invalid', /monthlyVolume/));
  assert.equal(store.getDocument().scenarios.length, 1);
  assert.equal((await store.deleteScenario('sc1')).scenarios.length, 0);
  (await assertStoreError(async () => (await store.deleteScenario('sc1')), 'not-found'));
});

test('import: invalid files leave current data untouched', async () => {
  const { storage, store } = (await seeded());
  const before = store.getDocument();
  const rawBefore = storage.data.get(STORAGE_KEY);
  const withCycle = smallDocument();
  withCycle.recipes.unshift(prep('pa', [line('l1', 'prep', 'pb')]), prep('pb', [line('l1', 'prep', 'pa')]));
  const unknownRef = smallDocument();
  unknownRef.recipes[0].lines[0].ref.id = 'ghost';
  const wrongType = smallDocument();
  wrongType.ingredients[0].prices[0].packPriceCents = '500';
  const cases = [
    ['{not json', 'corrupt-json'],
    [JSON.stringify({ ...smallDocument(), version: 7 }), 'unsupported-version'],
    [JSON.stringify(withCycle), 'invalid'],
    [JSON.stringify(unknownRef), 'invalid'],
    [JSON.stringify(wrongType), 'invalid'],
    ['null', 'invalid'],
  ];
  for (const [text, code] of cases) {
    (await assertStoreError(async () => (await store.importJSON(text)), code));
    assert.equal(store.getDocument(), before);
    assert.equal(storage.data.get(STORAGE_KEY), rawBefore);
  }
});

test('import: write failure is atomic too; export then import round-trips', async () => {
  const demoStore = newStore();
  (await demoStore.load());
  const exported = (await demoStore.exportJSON());
  assert.deepEqual(decoded(exported), demoStore.getDocument());

  const { storage, store } = (await seeded());
  const before = store.getDocument();
  storage.failOnSet = quotaError();
  (await assertStoreError(async () => (await store.importJSON(exported)), 'quota'));
  assert.equal(store.getDocument(), before);
  storage.failOnSet = null;
  const imported = (await store.importJSON(exported));
  assert.deepEqual(imported, demoStore.getDocument());
  assert.deepEqual(decoded(storage.data.get(STORAGE_KEY)), imported);
  assert.deepEqual(imported.ingredients.map((i) => i.prices), demoStore.getDocument().ingredients.map((i) => i.prices));
});

test('previous documents and inputs are never mutated (deep-freeze)', async () => {
  const { store } = (await seeded());
  const history = [];
  const keep = (doc) => { history.push([doc, JSON.stringify(doc)]); return doc; };
  keep(store.getDocument());
  const recipeInput = deepFreeze(dish('d9', [line('l1', 'ingredient', 'i2')]));
  const priceInput = deepFreeze({ packPriceCents: 10, packSizeMilli: 1000 });
  keep((await store.addPrice('i2', priceInput)));
  keep((await store.addIngredient({ name: 'Pepper', unit: 'g' })).document);
  keep((await store.updateIngredient('i2', { name: 'Chili' })));
  keep((await store.saveRecipe(recipeInput)).document);
  keep((await store.saveScenario(deepFreeze(makeScenario(store.getDocument(), 'd9')))).document);
  keep((await store.updateSettings({ defaultVatRateBp: 2100 })));
  keep((await store.deleteScenario('sc1')));
  keep((await store.deleteRecipe('d9')));
  keep((await store.importJSON(JSON.stringify(smallDocument()))));
  keep((await store.resetToDemo()));
  for (const [doc, snapshot] of history) {
    assert.equal(JSON.stringify(doc), snapshot);
    assert.ok(Object.isFrozen(doc) && Object.isFrozen(doc.ingredients[0]));
  }
});

test('save() validates before writing', async () => {
  const { storage, store } = (await seeded());
  const rawBefore = storage.data.get(STORAGE_KEY);
  const bad = clone(store.getDocument());
  bad.recipes[1].portions = 0;
  (await assertStoreError(async () => (await store.save(bad)), 'invalid', /portions/));
  assert.equal(storage.data.get(STORAGE_KEY), rawBefore);
  const good = clone(store.getDocument());
  good.settings.defaultVatRateBp = 2100;
  assert.equal((await store.save(good)).settings.defaultVatRateBp, 2100);
  assert.equal(decoded(storage.data.get(STORAGE_KEY)).settings.defaultVatRateBp, 2100);
});

test('demo cost example still holds after a reset at an arbitrary time', async () => {
  const { recipeCost } = await import('../../src/calc/costing.js');
  const store = newStore(memoryStorage(), { now: () => '2028-02-29T23:59:59.999Z' });
  const doc = (await store.resetToDemo());
  const burger = doc.recipes.find((r) => r.name === 'Classic Burger');
  const at30 = daysBefore('2028-02-29T23:59:59.999Z', 30);
  assert.equal(recipeCost(burger, doc, { asOf: at30 }).costPerPortionMicro, 4_200_000n);
  assert.equal(recipeCost(burger, doc, { asOf: '2028-02-29T23:59:59.999Z' }).costPerPortionMicro, 4_850_000n);
});
