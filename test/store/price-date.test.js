import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPriceAtDate } from '../../src/calc/costing.js';
import { STORAGE_KEY, StoreError, createStore } from '../../src/store/store.js';
import { validateDocument } from '../../src/store/schema.js';
import { encoded } from './fixtures.js';
import { memoryStorage, readDemo, smallDocument } from './fixtures.js';

// smallDocument: every ingredient has one price recorded at 2026-01-01T00:00:00.000Z.
const NOW = '2026-11-01T10:00:00.000Z';
const PRICE = { packPriceCents: 650, packSizeMilli: 1_000_000 };

async function seeded(clock = NOW) {
  const store = createStore(memoryStorage({ [STORAGE_KEY]: encoded(smallDocument()) }), { now: () => clock, demo: readDemo() });
  await store.load();
  return store;
}

async function rejectsInvalid(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof StoreError, String(error));
    assert.equal(error.code, 'invalid');
    assert.match(error.message, pattern);
    return true;
  });
}

test('a past effectiveDate is recorded at 00:00:00.000Z of that UTC day', async () => {
  const store = await seeded();
  const doc = await store.addPrice('i1', PRICE, { effectiveDate: '2026-10-15' });
  assert.deepEqual(doc.ingredients[0].prices.at(-1), { seq: 2, recordedAt: '2026-10-15T00:00:00.000Z', ...PRICE });
  assert.deepEqual(validateDocument(doc, { now: NOW }).errors, []);
});

test('effectiveDate today (UTC) means "now"; no effectiveDate keeps the old behaviour', async () => {
  const store = await seeded();
  const doc = await store.addPrice('i1', PRICE, { effectiveDate: '2026-11-01' });
  assert.equal(doc.ingredients[0].prices.at(-1).recordedAt, NOW);
  const plain = await store.addPrice('i2', PRICE);
  assert.equal(plain.ingredients[1].prices.at(-1).recordedAt, NOW);
});

test('a price dated D is effective for a Dashboard comparison on D and later, not on D-1', async () => {
  const store = await seeded();
  const { prices } = (await store.addPrice('i1', { ...PRICE, packPriceCents: 777 }, { effectiveDate: '2026-10-15' })).ingredients[0];
  // The Dashboard compares at the end of the chosen UTC day.
  assert.equal(selectPriceAtDate(prices, '2026-10-14T23:59:59.999Z').packPriceCents, 500);
  assert.equal(selectPriceAtDate(prices, '2026-10-15T23:59:59.999Z').packPriceCents, 777);
  assert.equal(selectPriceAtDate(prices, '2026-10-16T23:59:59.999Z').packPriceCents, 777);
});

test('day boundaries do not depend on the process time zone (Amsterdam, DST change, Los Angeles)', async () => {
  const saved = process.env.TZ;
  try {
    for (const zone of ['Europe/Amsterdam', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = zone;
      for (const day of ['2026-03-29', '2026-10-25', '2026-06-15']) {
        const store = await seeded();
        const { prices } = (await store.addPrice('i1', { ...PRICE, packPriceCents: 777 }, { effectiveDate: day })).ingredients[0];
        const added = prices.at(-1);
        assert.equal(added.recordedAt, `${day}T00:00:00.000Z`, zone);
        const before = new Date(Date.parse(`${day}T00:00:00.000Z`) - 1).toISOString();
        assert.equal(selectPriceAtDate(prices, before).packPriceCents, 500, `${zone} ${day} before`);
        assert.equal(selectPriceAtDate(prices, `${day}T23:59:59.999Z`).packPriceCents, 777, `${zone} ${day} end of day`);
      }
    }
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

test('effectiveDate on the same UTC day as the previous price keeps history non-decreasing', async () => {
  const store = await seeded('2026-11-01T15:00:00.000Z');
  await store.addPrice('i1', { ...PRICE, packPriceCents: 700 }); // recorded 2026-11-01T15:00
  const doc = await store.addPrice('i1', { ...PRICE, packPriceCents: 800 }, { effectiveDate: '2026-11-01' });
  assert.equal(doc.ingredients[0].prices.at(-1).recordedAt, '2026-11-01T15:00:00.000Z');
  // Same instant: the later seq wins, so the newest entry is the current price.
  assert.equal(selectPriceAtDate(doc.ingredients[0].prices, '2026-11-01T23:59:59.999Z').packPriceCents, 800);
  assert.deepEqual(validateDocument(doc, { now: '2026-11-01T15:00:00.000Z' }).errors, []);
});

test('effectiveDate on the day of an earlier past price is clamped to that price, not before it', async () => {
  const store = await seeded();
  await store.addPrice('i1', { ...PRICE, packPriceCents: 700 }, { effectiveDate: '2026-10-15' }); // 2026-10-15T00:00
  const doc = await store.addPrice('i1', { ...PRICE, packPriceCents: 800 }, { effectiveDate: '2026-10-15' });
  assert.equal(doc.ingredients[0].prices.at(-1).recordedAt, '2026-10-15T00:00:00.000Z');
  assert.deepEqual(validateDocument(doc, { now: NOW }).errors, []);
});

test('effectiveDate earlier than the previous price date is refused and nothing changes', async () => {
  const store = await seeded();
  await store.addPrice('i1', PRICE, { effectiveDate: '2026-10-15' });
  const before = store.getDocument();
  await rejectsInvalid(store.addPrice('i1', PRICE, { effectiveDate: '2026-10-14' }), /2026-10-15/);
  await rejectsInvalid(store.addPrice('i1', PRICE, { effectiveDate: '2025-12-31' }), /earlier/);
  assert.equal(store.getDocument(), before);
});

test('effectiveDate in the future is refused', async () => {
  const store = await seeded();
  const before = store.getDocument();
  await rejectsInvalid(store.addPrice('i1', PRICE, { effectiveDate: '2026-11-03' }), /future/);
  await rejectsInvalid(store.addPrice('i1', PRICE, { effectiveDate: '2030-01-01' }), /future/);
  assert.equal(store.getDocument(), before);
});

test('a calendar day that has already started in a UTC+ zone (tomorrow in UTC) is accepted and recorded as now', async () => {
  const store = await seeded('2026-10-31T23:30:00.000Z'); // 00:30 on 1 Nov in Amsterdam
  const doc = await store.addPrice('i1', PRICE, { effectiveDate: '2026-11-01' });
  assert.equal(doc.ingredients[0].prices.at(-1).recordedAt, '2026-10-31T23:30:00.000Z');
});

test('malformed effectiveDate values are refused', async () => {
  const store = await seeded();
  for (const bad of ['', '15-10-2026', '2026-02-30', '2026-13-01', '2026-10-15T00:00:00Z', 20261015, null]) {
    await rejectsInvalid(store.addPrice('i1', PRICE, { effectiveDate: bad }), /effectiveDate/);
  }
});

test('addIngredient takes an initial price with a past effectiveDate', async () => {
  const store = await seeded();
  const { id, document } = await store.addIngredient({ name: 'Salt', unit: 'g', price: PRICE, effectiveDate: '2026-10-20' });
  assert.equal(document.ingredients.find((entry) => entry.id === id).prices[0].recordedAt, '2026-10-20T00:00:00.000Z');
  await rejectsInvalid(store.addIngredient({ name: 'Pepper', unit: 'g', price: PRICE, effectiveDate: '2027-01-01' }), /future/);
});
