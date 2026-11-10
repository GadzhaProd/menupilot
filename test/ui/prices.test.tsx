import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { todayInput, validateNewIngredient, validatePrice } from '@/ui/forms/ingredientForm';
import { summarizeUsers } from '@/ui/forms/usage';
import {
  go, renderApp, savedDocument, sauceDoc, storageWith, STORAGE_KEY,
} from './helpers';
import { NOW } from './helpers';
import type { MenuDocument } from '@/ui/domain/types';
import { ingredientInfos } from '@/ui/domain/simulator';
import { createBaselineSnapshot } from '@/ui/domain/calc';

const user = () => userEvent.setup();
const RANGE = { min: '2000-01-01', max: '2026-10-25' };
const base = { packSize: '1', packSizeUnit: 'kg' as const, packPrice: '2,00' };

beforeEach(() => { window.location.hash = ''; });

describe('price form rules', () => {
  it('a zero price needs the explicit confirmation; empty stays "no price"', () => {
    expect(validatePrice({ ...base, packPrice: '0' }, null)).toMatchObject({ ok: false, errors: { confirmZero: expect.stringMatching(/free product/) } });
    expect(validatePrice({ ...base, packPrice: '0,00', confirmZero: true }, null)).toMatchObject({ ok: true, value: { packPriceCents: 0 } });
    expect(validatePrice({ ...base, packPrice: '2', confirmZero: false }, null).ok).toBe(true);
    expect(validateNewIngredient({ name: 'Salt', packSize: '', packSizeUnit: 'kg', packPrice: '' })).toEqual({ ok: true, value: { name: 'Salt', unit: 'g' } });
    expect(validateNewIngredient({ name: 'Salt', packSize: '1', packSizeUnit: 'kg', packPrice: '0' })).toMatchObject({ ok: false, errors: { confirmZero: expect.any(String) } });
  });

  it('"valid from" must lie between 2000-01-01 and today; today passes no date', () => {
    expect(validatePrice({ ...base, validFrom: '2026-10-25' }, null, undefined, RANGE)).toMatchObject({ ok: true });
    expect((validatePrice({ ...base, validFrom: '2026-10-25' }, null, undefined, RANGE) as { value: object }).value).not.toHaveProperty('effectiveDate');
    expect(validatePrice({ ...base, validFrom: '' }, null, undefined, RANGE)).toMatchObject({ ok: true });
    expect(validatePrice({ ...base, validFrom: '2026-10-01' }, null, undefined, RANGE)).toMatchObject({ ok: true, value: { effectiveDate: '2026-10-01' } });
    expect(validatePrice({ ...base, validFrom: '2026-09-01' }, null, undefined, RANGE)).toMatchObject({ ok: true, value: { effectiveDate: '2026-09-01' } });
    expect(validatePrice({ ...base, validFrom: '2026-08-31' }, null, undefined, RANGE)).toMatchObject({ ok: true });
    expect(validatePrice({ ...base, validFrom: '1999-12-31' }, null, undefined, RANGE)).toMatchObject({ ok: false, errors: { validFrom: expect.stringMatching(/2000-01-01/) } });
    expect(validatePrice({ ...base, validFrom: '2026-10-26' }, null, undefined, RANGE)).toMatchObject({ ok: false, errors: { validFrom: expect.stringMatching(/future/) } });
    expect(validatePrice({ ...base, validFrom: '2026-02-30' }, null, undefined, RANGE)).toMatchObject({ ok: false, errors: { validFrom: expect.stringMatching(/valid date/) } });
  });

  it('uses UTC for today', () => {
    // Calendar days are UTC days everywhere, whatever the local clock says.
    expect(todayInput(new Date('2026-10-24T23:30:00.000Z'))).toBe('2026-10-24');
    expect(todayInput(new Date('2026-10-25T00:00:00.000Z'))).toBe('2026-10-25');
  });

  it('simulator current and earlier prices follow invoice dates after a backdated addition', () => {
    const doc = sauceDoc();
    const ingredient = doc.ingredients[0]!;
    ingredient.prices.push({ ...ingredient.prices[0]!, seq: 2, recordedAt: NOW, packPriceCents: 500 });
    ingredient.prices.push({ ...ingredient.prices[0]!, seq: 3, recordedAt: '2026-09-15T00:00:00.000Z', packPriceCents: 300 });
    doc.recipes = [recipeUsing('dish', 'Dish', 'ingredient', ingredient.id)] as typeof doc.recipes;
    const baseline = createBaselineSnapshot(doc as unknown as MenuDocument, 'dish', NOW);
    const info = ingredientInfos(baseline).find(i => i.id === ingredient.id)!;
    expect(info.price?.seq).toBe(2);
    expect(info.earlier?.seq).toBe(3);
  });

  it('lists at most 3 users, then "and N more"', () => {
    expect(summarizeUsers(['a', 'b', 'c', 'd', 'e'])).toEqual({ shown: ['a', 'b', 'c'], more: 2 });
    expect(summarizeUsers(['a', 'b'])).toEqual({ shown: ['a', 'b'], more: 0 });
  });
});

async function openIngredients(storage = storageWith(sauceDoc())) {
  await renderApp(storage);
  await go('#/ingredients');
  await screen.findByRole('heading', { level: 1, name: 'Ingredients' });
  return storage;
}

describe('zero price', () => {
  it('Add ingredient: a zero price shows a warning and is saved only after the box is ticked', async () => {
    const u = user();
    const storage = await openIngredients();
    const before = storage.data.get(STORAGE_KEY);
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Name'), 'Water');
    await u.type(within(dialog).getByLabelText(/Pack size/), '1');
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    await u.type(within(dialog).getByLabelText(/Pack price/), '0');
    expect(within(dialog).getByText(/count this product as free/)).toBeTruthy();
    expect(within(dialog).getByText(/leave the price empty/)).toBeTruthy();

    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));
    const box = within(dialog).getByRole('checkbox', { name: /really is free/ });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(box);
    expect(within(dialog).getByText(/Tick the box to confirm a free product/)).toBeTruthy();
    expect(storage.data.get(STORAGE_KEY)).toBe(before);

    await u.click(box);
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(savedDocument(storage).ingredients.at(-1)).toMatchObject({ name: 'Water', prices: [{ packPriceCents: 0 }] });
  });

  it('New price: editing the price resets the confirmation; a non-zero price needs no box', async () => {
    const u = user();
    const storage = await openIngredients();
    await u.click(screen.getByRole('button', { name: 'New price for Tomatoes' }));
    const dialog = await screen.findByRole('dialog');
    const price = within(dialog).getByLabelText(/Pack price/);
    await u.type(price, '0');
    await u.click(within(dialog).getByRole('checkbox'));
    await u.clear(price);
    await u.type(price, '0,00');
    expect((within(dialog).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(savedDocument(storage).ingredients.find((entry) => entry.id === 'ing_tomato')?.prices).toHaveLength(1);

    await u.clear(price);
    await u.type(price, '2,10');
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(savedDocument(storage).ingredients.find((entry) => entry.id === 'ing_tomato')?.prices).toHaveLength(2);
  });
});

describe('Price valid from', () => {
  it('New price with a past invoice date is recorded at the start of that UTC day', async () => {
    const u = user();
    const storage = await openIngredients();
    await u.click(screen.getByRole('button', { name: 'New price for Tomatoes' }));
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText('Price valid from') as HTMLInputElement;
    expect(date.value).toBe(todayInput(new Date(NOW)));
    expect(date.min).toBe('2000-01-01');
    expect(date.max).toBe(todayInput(new Date(NOW)));
    await u.type(within(dialog).getByLabelText(/Pack price/), '2,50');
    fireEvent.change(date, { target: { value: '2026-09-15' } });
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const prices = savedDocument(storage).ingredients.find((entry) => entry.id === 'ing_tomato')?.prices ?? [];
    expect(prices.at(-1)).toMatchObject({ seq: 2, recordedAt: '2026-09-15T00:00:00.000Z', packPriceCents: 250 });
  });

  it('shows a field error for a date before 2000 or in the future, and writes nothing', async () => {
    const u = user();
    const storage = await openIngredients();
    const before = storage.data.get(STORAGE_KEY);
    await u.click(screen.getByRole('button', { name: 'New price for Tomatoes' }));
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText('Price valid from') as HTMLInputElement;
    await u.type(within(dialog).getByLabelText(/Pack price/), '2,50');

    fireEvent.change(date, { target: { value: '1999-12-31' } });
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(date.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(date);
    expect(document.getElementById(date.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '')?.textContent).toMatch(/on or after 1 Jan 2000/);

    fireEvent.change(date, { target: { value: '2999-01-01' } });
    expect(document.getElementById(date.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '')?.textContent).toMatch(/cannot be in the future/);
    expect(storage.data.get(STORAGE_KEY)).toBe(before);

    fireEvent.change(date, { target: { value: '2026-09-01' } });
    expect(date.getAttribute('aria-invalid')).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an older invoice is allowed after a later price; same-day warning and dated history stay clear', async () => {
    const u = user();
    const doc = sauceDoc();
    doc.ingredients[0]!.prices[0]!.recordedAt = NOW;
    const storage = await openIngredients(storageWith(doc));
    await u.click(screen.getByRole('button', { name: 'New price for Tomatoes' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('status').textContent).toMatch(/already a price on this date/);
    await u.type(within(dialog).getByLabelText(/Pack price/), '1,00');
    fireEvent.change(within(dialog).getByLabelText('Price valid from'), { target: { value: '2026-08-01' } });
    expect(within(dialog).queryByText(/already a price on this date/)).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const ingredient = savedDocument(storage).ingredients[0]!;
    expect(ingredient.prices.at(-1)).toMatchObject({ packPriceCents: 100, recordedAt: '2026-08-01T00:00:00.000Z' });
    await u.click(screen.getByRole('button', { name: 'Price history of Tomatoes' }));
    const rows = within(screen.getByRole('dialog')).getAllByRole('row');
    expect(rows[1]!.textContent).toContain('€2.00');
    expect(rows[2]!.textContent).toContain('€1.00');
  });

  it('Add ingredient takes the initial price date too', async () => {
    const u = user();
    const storage = await openIngredients();
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Name'), 'Flour');
    await u.type(within(dialog).getByLabelText(/Pack size/), '1');
    await u.type(within(dialog).getByLabelText(/Pack price/), '1,20');
    fireEvent.change(within(dialog).getByLabelText('Price valid from'), { target: { value: '2026-10-10' } });
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));
    expect(savedDocument(storage).ingredients.at(-1)).toMatchObject({ name: 'Flour', prices: [{ recordedAt: '2026-10-10T00:00:00.000Z', packPriceCents: 120 }] });
  });
});

function recipeUsing(id: string, name: string, kind: 'ingredient' | 'prep', ref: string) {
  return {
    id, name, kind: 'dish' as const, menuPriceInclVatCents: 1000, vatRateBp: 900, portions: 1,
    lines: [{ id: 'l1', ref: { kind, id: ref }, netQtyMilli: 100_000, yieldBp: 10_000 }],
  };
}

describe('where it is used', () => {
  it('the ingredient delete error names up to 3 recipes and "and N more"', async () => {
    const u = user();
    const doc = sauceDoc();
    doc.recipes = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((name) => recipeUsing(`d_${name}`, name, 'ingredient', 'ing_tomato')) as typeof doc.recipes;
    const storage = await openIngredients(storageWith(doc));
    await u.click(screen.getByRole('button', { name: 'Delete Tomatoes' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/cannot be deleted yet/)).toBeTruthy(); // warned before clicking
    await u.click(within(dialog).getByRole('button', { name: 'Delete ingredient' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('This ingredient is still used by recipes and cannot be deleted.');
    expect(within(dialog).getByText(/and 2 more/)).toBeTruthy();
    expect(within(dialog).getAllByRole('link').map((link) => link.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(savedDocument(storage).ingredients.some((entry) => entry.id === 'ing_tomato')).toBe(true);
  });

  it('the prep delete dialog warns up front, in lower case, and names the recipes', async () => {
    const u = user();
    const doc = sauceDoc();
    doc.recipes = [
      { id: 'p_sauce', name: 'Tomato sauce', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [{ id: 'l1', ref: { kind: 'ingredient', id: 'ing_tomato' }, netQtyMilli: 500_000, yieldBp: 10_000 }] },
      recipeUsing('d_a', 'Pasta', 'prep', 'p_sauce'), recipeUsing('d_b', 'Pizza', 'prep', 'p_sauce'),
    ] as typeof doc.recipes;
    await renderApp(storageWith(doc));
    await go('#/recipe/p_sauce');
    await screen.findByRole('heading', { level: 1 });
    await u.click(screen.getByRole('button', { name: 'Delete prep' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).not.toContain('The Prep');
    expect(dialog.textContent).toContain('A prep used in a recipe cannot be deleted.');
    expect(within(dialog).getByText(/used by other recipes, so it cannot be deleted yet/)).toBeTruthy();
    expect(within(dialog).getAllByRole('link').map((link) => link.textContent)).toEqual(['Pasta', 'Pizza']);
    await u.click(within(dialog).getByRole('button', { name: 'Delete prep' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('This prep is still used by other recipes and cannot be deleted.');
  });
});

describe('Dashboard without prices on the comparison date', () => {
  it('explains that there is nothing to compare instead of showing a bare €0.00', async () => {
    const u = user();
    await renderApp();
    fireEvent.change(screen.getByLabelText('Choose date'), { target: { value: '2026-01-01' } });
    const note = screen.getByText('No dish has complete ingredient prices on 1 Jan 2026', { selector: 'p.font-semibold' }).closest('[role="status"]') as HTMLElement;
    expect(note.textContent).toMatch(/This is not “no change”/);
    expect(note.textContent).toMatch(/add a past supplier price excl. VAT with its invoice date/);
    const impact = screen.getByRole('heading', { name: 'Monthly impact at your volume' }).closest('section') as HTMLElement;
    expect(impact.textContent).toContain('—');
    expect(impact.textContent).not.toContain('€0.00');
    expect(impact.textContent).not.toMatch(/incomplete/);
    // The total under the table says the same, not €0.00.
    const total = screen.getByText('Menu monthly impact (dishes with a volume estimate)');
    expect(total.parentElement?.textContent).toContain('—');
    expect(total.parentElement?.textContent).not.toContain('€0.00');
    expect(screen.getByRole('heading', { name: /Largest/ }).closest('section')?.textContent).toContain('No dish has complete ingredient prices on 1 Jan 2026');

    await u.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    expect(screen.getByText('Op 1 jan 2026 heeft nog geen enkel gerecht volledige ingrediëntprijzen', { selector: 'p.font-semibold' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Kies een datum'), { target: { value: '2026-10-11' } });
    expect(screen.queryByText(/heeft nog geen enkel gerecht volledige ingrediëntprijzen/)).toBeNull();
  });
});
