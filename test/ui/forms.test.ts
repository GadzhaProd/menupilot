import { describe, expect, it } from 'vitest';
import {
  validateName, validateNewIngredient, validatePrice,
} from '@/ui/forms/ingredientForm';
import {
  basisPointsToInput, centsToInput, formatQuantity, formatTenthsPct, parseWholeNumber, parseYieldPercent,
  quantityToInput,
} from '@/ui/forms/numbers';
import {
  baseUnitOfRef, blankDraft, buildRecipe, draftFromRecipe, parseLine, vatOptions, type Catalog, type RecipeDraft,
} from '@/ui/forms/recipeForm';
import { friendlySaveError } from '@/ui/forms/saveError';
import type { Recipe } from '@/ui/domain/types';

const catalog: Catalog = {
  ingredients: [
    { id: 'ing_tomato', name: 'Tomatoes', unit: 'g', prices: [] },
    { id: 'ing_milk', name: 'Milk', unit: 'ml', prices: [] },
    { id: 'ing_bun', name: 'Bun', unit: 'pc', prices: [] },
  ],
  recipes: [
    { id: 'prep_sauce', name: 'Sauce', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [] },
    { id: 'dish_a', name: 'Pasta', kind: 'dish', menuPriceInclVatCents: 1650, vatRateBp: 900, portions: 1, lines: [] },
  ],
};

describe('number fields', () => {
  it('turns stored integers back into the text a person types', () => {
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(5)).toBe('0.05');
    expect(centsToInput(1_000_000)).toBe('10000.00');
    expect(basisPointsToInput(10_000)).toBe('100');
    expect(basisPointsToInput(8550)).toBe('85.5');
    expect(basisPointsToInput(1)).toBe('0.01');
    expect(centsToInput(320, 'nl')).toBe('3,20');
    expect(quantityToInput(1_500_000, 'ml', 'nl')).toEqual({ text: '1,5', unit: 'l' });
  });

  it('shows a quantity in kg or l when that is how it reads best, and always round-trips', () => {
    expect(quantityToInput(150_000, 'g')).toEqual({ text: '150', unit: 'g' });
    expect(quantityToInput(2_000_000, 'g')).toEqual({ text: '2', unit: 'kg' });
    expect(quantityToInput(1_500_000, 'ml')).toEqual({ text: '1.5', unit: 'l' });
    expect(quantityToInput(8_000, 'pc')).toEqual({ text: '8', unit: 'pc' });
    expect(quantityToInput(12_340, 'g')).toEqual({ text: '12.34', unit: 'g' });
    expect(formatQuantity(250_000, 'g')).toBe('250 g');
    expect(formatQuantity(1_000_000, 'g')).toBe('1 kg');
  });

  it('parses yield percentages and rejects 0, above 100 and non-numbers', () => {
    expect(parseYieldPercent('100')).toEqual({ ok: true, value: 10_000 });
    expect(parseYieldPercent('85,5')).toEqual({ ok: true, value: 8550 });
    expect(parseYieldPercent('0.01')).toEqual({ ok: true, value: 1 });
    for (const bad of ['0', '0.00', '100.01', '101', '-5', 'abc', '', '80%', '1e2']) {
      expect(parseYieldPercent(bad).ok, bad).toBe(false);
    }
  });

  it('parses whole numbers without floats', () => {
    expect(parseWholeNumber('12', 1, 'x')).toEqual({ ok: true, value: 12 });
    expect(parseWholeNumber('0', 0, 'x')).toEqual({ ok: true, value: 0 });
    for (const bad of ['0', '1.5', '-1', '', 'a', '9007199254740993']) {
      expect(parseWholeNumber(bad, 1, 'msg')).toEqual({ ok: false, error: 'msg' });
    }
  });

  it('formats tenths of a percent from BigInt, including negatives', () => {
    expect(formatTenthsPct(285n)).toBe('28.5%');
    expect(formatTenthsPct(5n)).toBe('0.5%');
    expect(formatTenthsPct(-155n)).toBe('-15.5%');
    expect(formatTenthsPct(1000n)).toBe('100.0%');
  });
});

describe('ingredient forms', () => {
  it('converts kg and g pack sizes to the stored base unit without changing the price', () => {
    expect(validatePrice({ packSize: '1', packSizeUnit: 'kg', packPrice: '11,20' }, null)).toEqual({
      ok: true, value: { packPriceCents: 1120, packSizeMilli: 1_000_000, unit: 'g' },
    });
    expect(validatePrice({ packSize: '250', packSizeUnit: 'g', packPrice: '2.80' }, null)).toEqual({
      ok: true, value: { packPriceCents: 280, packSizeMilli: 250_000, unit: 'g' },
    });
  });

  it('puts one message on each wrong field', () => {
    const result = validatePrice({ packSize: '0', packSizeUnit: 'kg', packPrice: '-1' }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.packSize).toMatch(/greater than zero/i);
      expect(result.errors.packPrice).toMatch(/non-negative amount/i);
    }
    const empty = validatePrice({ packSize: '', packSizeUnit: 'kg', packPrice: '' }, null);
    expect(empty).toMatchObject({ ok: false, errors: { packSize: expect.stringMatching(/pack size/i), packPrice: expect.stringMatching(/excl\. VAT/) } });
  });

  it('rejects a pack size in the wrong kind of unit for a known ingredient', () => {
    const result = validatePrice({ packSize: '1', packSizeUnit: 'l', packPrice: '1' }, 'g');
    expect(result).toMatchObject({ ok: false, errors: { packSize: 'This ingredient is measured in g. Use g or kg.' } });
  });

  it('rejects more decimals than allowed and thousands separators', () => {
    expect(validatePrice({ packSize: '1.2345', packSizeUnit: 'kg', packPrice: '1' }, null).ok).toBe(false);
    expect(validatePrice({ packSize: '1', packSizeUnit: 'kg', packPrice: '1,000.50' }, null).ok).toBe(false);
    expect(validatePrice({ packSize: '1', packSizeUnit: 'kg', packPrice: '1.999' }, null).ok).toBe(false);
  });

  it('a new ingredient needs a name; size and price must come together or not at all', () => {
    expect(validateNewIngredient({ name: ' ', packSize: '', packSizeUnit: 'kg', packPrice: '' })).toMatchObject({ ok: false, errors: { name: 'Enter a name.' } });
    expect(validateNewIngredient({ name: 'Flour', packSize: '1', packSizeUnit: 'kg', packPrice: '' })).toMatchObject({ ok: false, errors: { packPrice: expect.any(String) } });
    expect(validateNewIngredient({ name: ' Flour ', packSize: '', packSizeUnit: 'kg', packPrice: '' }))
      .toEqual({ ok: true, value: { name: 'Flour', unit: 'g' } });
    expect(validateNewIngredient({ name: 'Milk', packSize: '1', packSizeUnit: 'l', packPrice: '1.05' }))
      .toEqual({ ok: true, value: { name: 'Milk', unit: 'ml', price: { packPriceCents: 105, packSizeMilli: 1_000_000 } } });
  });

  it('limits the name length', () => {
    expect(validateName('x'.repeat(201)).ok).toBe(false);
    expect(validateName('x'.repeat(200)).ok).toBe(true);
  });
});

describe('recipe form', () => {
  const dishDraft = (patch: Partial<RecipeDraft> = {}): RecipeDraft => ({
    ...blankDraft('dish', 900),
    name: 'Pasta Bolognese',
    menuPrice: '16,50',
    lines: [{ id: 'l1', ref: 'ingredient:ing_tomato', qty: '800', unit: 'g', yieldPct: '100', stored: null }],
    ...patch,
  });

  it('builds a dish in the stored shape: integers only, quantity in the base unit of the reference', () => {
    const built = buildRecipe(dishDraft({ monthlyVolume: '300' }), 'dish_new', catalog);
    expect(built).toEqual({
      ok: true,
      recipe: {
        id: 'dish_new', kind: 'dish', name: 'Pasta Bolognese', menuPriceInclVatCents: 1650, vatRateBp: 900, portions: 1, monthlyVolume: 300,
        lines: [{ id: 'l1', ref: { kind: 'ingredient', id: 'ing_tomato' }, netQtyMilli: 800_000, yieldBp: 10_000 }],
      },
    });
  });

  it('leaves monthlyVolume out when empty, and keeps 0 when typed', () => {
    const empty = buildRecipe(dishDraft(), 'd', catalog);
    expect(empty.ok && 'monthlyVolume' in empty.recipe).toBe(false);
    const zero = buildRecipe(dishDraft({ monthlyVolume: '0' }), 'd', catalog);
    expect(zero.ok && zero.recipe.kind === 'dish' && zero.recipe.monthlyVolume).toBe(0);
  });

  it('reads kg for a weight ingredient and l for a volume ingredient', () => {
    const lines = [
      { id: 'a', ref: 'ingredient:ing_tomato', qty: '1,5', unit: 'kg' as const, yieldPct: '80', stored: null },
      { id: 'b', ref: 'ingredient:ing_milk', qty: '0.25', unit: 'l' as const, yieldPct: '100', stored: null },
      { id: 'c', ref: 'ingredient:ing_bun', qty: '2', unit: 'pc' as const, yieldPct: '100', stored: null },
    ];
    const built = buildRecipe(dishDraft({ lines }), 'd', catalog);
    expect(built.ok && built.recipe.lines.map((line) => [line.netQtyMilli, line.yieldBp])).toEqual([[1_500_000, 8000], [250_000, 10_000], [2000, 10_000]]);
  });

  it('rejects a unit that does not fit the ingredient (mass vs volume)', () => {
    const lines = [{ id: 'a', ref: 'ingredient:ing_tomato', qty: '1', unit: 'l' as const, yieldPct: '100', stored: null }];
    const built = buildRecipe(dishDraft({ lines }), 'd', catalog);
    expect(built).toMatchObject({ ok: false, errors: { 'line:a:qty': 'This line is measured in g. Use g or kg.' } });
  });

  it('collects an error for every wrong field of a dish', () => {
    const built = buildRecipe(dishDraft({
      name: '', menuPrice: 'abc', portions: '0', monthlyVolume: '-3', vatRateBp: '',
      lines: [{ id: 'a', ref: '', qty: '', unit: 'g', yieldPct: '0', stored: null }],
    }), 'd', catalog);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(Object.keys(built.errors).sort()).toEqual(
        ['line:a:qty', 'line:a:ref', 'line:a:yield', 'menuPrice', 'monthlyVolume', 'name', 'portions', 'vatRateBp'].sort(),
      );
    }
  });

  it('a prep needs a batch size and cannot use itself', () => {
    const prep: RecipeDraft = {
      ...blankDraft('prep', 900), name: 'Sauce', outputQty: '1', outputUnit: 'kg',
      lines: [{ id: 'a', ref: 'prep:prep_sauce', qty: '100', unit: 'g', yieldPct: '100', stored: null }],
    };
    expect(buildRecipe(prep, 'prep_sauce', catalog)).toMatchObject({ ok: false, errors: { 'line:a:ref': 'A prep cannot use itself.' } });
    expect(buildRecipe({ ...prep, outputQty: '' }, 'other', catalog)).toMatchObject({ ok: false, errors: { outputQty: expect.any(String) } });
    const ok = buildRecipe(prep, 'other', catalog);
    expect(ok.ok && ok.recipe).toMatchObject({ kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g' });
  });

  it('keeps the stored quantity of an untouched line, even one the form could not type again', () => {
    const line = { id: 'a', ref: 'ingredient:ing_tomato', qty: '1000.123', unit: 'g' as const, yieldPct: '100', stored: { milli: 1_000_123, qty: '1000.123', unit: 'g' as const } };
    expect(parseLine(line, null, catalog)).toMatchObject({ ok: true, line: { netQtyMilli: 1_000_123 } });
    expect(parseLine({ ...line, qty: '1000.1234' }, null, catalog).ok).toBe(false);
  });

  it('opens a stored recipe as text and builds the same recipe back', () => {
    const stored: Recipe = {
      id: 'dish_x', name: 'Test', kind: 'dish', menuPriceInclVatCents: 1308, vatRateBp: 900, portions: 4, monthlyVolume: 300,
      lines: [
        { id: 'l1', ref: { kind: 'ingredient', id: 'ing_tomato' }, netQtyMilli: 2_000_000, yieldBp: 8550 },
        { id: 'l2', ref: { kind: 'prep', id: 'prep_sauce' }, netQtyMilli: 150_000, yieldBp: 10_000 },
      ],
    };
    const draft = draftFromRecipe(stored, catalog);
    expect(draft).toMatchObject({ menuPrice: '13.08', vatRateBp: '900', portions: '4', monthlyVolume: '300' });
    expect(draft.lines.map((line) => [line.qty, line.unit, line.yieldPct])).toEqual([['2', 'kg', '85.5'], ['150', 'g', '100']]);
    expect(buildRecipe(draft, 'dish_x', catalog)).toEqual({ ok: true, recipe: stored });
  });

  it('finds the unit of a reference', () => {
    expect(baseUnitOfRef('ingredient:ing_milk', catalog)).toBe('ml');
    expect(baseUnitOfRef('prep:prep_sauce', catalog)).toBe('g');
    expect(baseUnitOfRef('prep:dish_a', catalog)).toBeNull();
    expect(baseUnitOfRef('', catalog)).toBeNull();
  });

  it('offers 9 %, 21 % and 0 %, plus a stored rate that is something else', () => {
    expect(vatOptions('900').map((option) => option.label)).toEqual(['9%', '21%', '0%']);
    expect(vatOptions('1900').map((option) => option.label)).toEqual(['9%', '21%', '0%', '19%']);
  });
});

describe('friendlySaveError', () => {
  it('explains a prep loop in plain words', () => {
    const text = friendlySaveError('The data is not valid: ...', ['recipes[3]: prep cycle Sauce A -> Sauce B -> Sauce A']);
    expect(text).toMatch(/loop/);
    expect(text).toContain('Sauce A uses Sauce B uses Sauce A');
  });

  it('explains the nesting limit and passes other messages through', () => {
    expect(friendlySaveError('x', ['recipes[0]: prep nesting depth is 6; the maximum is 5'])).toMatch(/at most 5 levels.*make 6/);
    expect(friendlySaveError('Browser storage is full.', [])).toBe('Browser storage is full.');
  });
});
