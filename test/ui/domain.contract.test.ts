import { describe, expect, it } from 'vitest';
import * as costing from '@/calc/costing.js';
import * as money from '@/calc/money.js';
import * as simulate from '@/calc/simulate.js';
import * as units from '@/calc/units.js';
import * as schema from '@/store/schema.js';
import * as store from '@/store/store.js';
import { dishRows } from '@/ui/domain/calc';
import type { MenuDocument } from '@/ui/domain/types';
import { demo, demoCopy } from './helpers';

// src/ui/domain/core.d.ts declares the types of the plain-JS core by hand.
// If the core renames or drops an export, this list and the declaration must follow.
const DECLARED: Record<string, [Record<string, unknown>, string[]]> = {
  '@/calc/money.js': [money, ['roundDiv', 'parseMoneyToCents', 'formatEURFromCents', 'formatEURFromMicro']],
  '@/calc/units.js': [units, ['normalizeUnit', 'areUnitsCompatible', 'assertCompatibleUnits', 'unitPriceSuffix', 'parseQuantityToMilli']],
  '@/calc/costing.js': [costing, [
    'selectPriceAtDate', 'ingredientLineCostMicro', 'netPriceMicro', 'monthlyContributionCents', 'metrics',
    'recipeCost', 'batchCostMicro', 'prepLineCostMicro', 'prepUnitCostDisplay', 'packUnitPriceDisplay',
  ]],
  '@/calc/simulate.js': [simulate, ['createBaselineSnapshot', 'simulate', 'compare', 'isBaselineStale']],
  '@/store/store.js': [store, ['STORAGE_KEY', 'StoreError', 'createStore']],
  '@/store/schema.js': [schema, ['FORMAT_VERSION', 'validateDocument']],
};

describe('typed boundary (core.d.ts) matches the real core', () => {
  for (const [name, [module, exports]] of Object.entries(DECLARED)) {
    it(`${name} exports what is declared`, () => {
      for (const exported of exports) {
        expect(module[exported], `${name} should export ${exported}`).toBeDefined();
      }
    });
  }

  it('the demo file is a valid document of the declared version', () => {
    expect(schema.validateDocument(demo)).toEqual({ valid: true, errors: [] });
    expect(demo.version).toBe(schema.FORMAT_VERSION);
  });
});

describe('dishRows', () => {
  const doc = demo as unknown as MenuDocument;

  it('returns BigInt results derived from the document and leaves it untouched', () => {
    const before = JSON.stringify(doc);
    const rows = dishRows(doc);
    expect(rows.map((row) => row.name)).toEqual([
      'Classic Burger', 'Crispy Chicken Burger', 'Fries with Burger Sauce', 'Tomato Soup', 'House Red Wine (glass)',
    ]);
    const burger = rows[0];
    expect(burger?.costPerPortionMicro).toBe(4_850_000n);
    expect(burger?.contributionMicro).toBe(7_150_000n);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('uses prices at the requested date', () => {
    // Before the first beef price rise the burger cost EUR 4.20 (see test/store/demo.test.js).
    const rows = dishRows(doc, '2026-09-01T00:00:00Z');
    expect(rows[0]?.costPerPortionMicro).toBe(4_200_000n);
  });

  it('reports a calculation error on the row instead of throwing', () => {
    const broken = demoCopy();
    const burger = broken.recipes.find((recipe) => recipe.id === 'dish_classic_burger');
    if (burger) burger.lines[0]!.ref.id = 'ing_missing';
    const rows = dishRows(broken as unknown as MenuDocument);
    expect(rows[0]).toMatchObject({ name: 'Classic Burger', status: 'error', costPerPortionMicro: null, contributionMicro: null });
    expect(rows[0]?.error).toBeTruthy();
    expect(rows[1]?.status).toBe('ready');
  });
});
