import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBaselineSnapshot } from '@/ui/domain/calc';
import type { MenuDocument } from '@/ui/domain/types';
import {
  demoCopy, go, memoryStorage, renderApp, savedDocument, sauceDoc, storageWith, STORAGE_KEY,
} from './helpers';

const user = () => userEvent.setup();

beforeEach(() => { window.location.hash = ''; });

async function open(hash: string, storage = memoryStorage()) {
  renderApp(storage);
  await go(hash);
  await screen.findByRole('heading', { level: 1 });
  return storage;
}

const line = (position: number) => within(screen.getByRole('group', { name: `Line ${position}` }));
const summary = () => within(screen.getByRole('heading', { name: 'Cost' }).closest('section') as HTMLElement);
/** The value next to a label in the cost summary. */
const costOf = (label: RegExp | string) => {
  const term = summary().getByText(label, { selector: 'dt' });
  return term.nextElementSibling?.textContent;
};

async function fillLine(u: ReturnType<typeof user>, position: number, ref: string, qty: string, extra: { unit?: string; yieldPct?: string } = {}) {
  const row = line(position);
  await u.selectOptions(row.getByLabelText('Ingredient or prep'), ref);
  await u.clear(row.getByLabelText(/Net quantity/));
  await u.type(row.getByLabelText(/Net quantity/), qty);
  if (extra.unit) await u.selectOptions(row.getByLabelText('Unit'), extra.unit);
  if (extra.yieldPct) {
    await u.clear(row.getByLabelText('Yield %'));
    await u.type(row.getByLabelText('Yield %'), extra.yieldPct);
  }
}

describe('Recipes list', () => {
  it('lists dishes and preps separately, with cost per portion and per kg', async () => {
    await open('#/recipes');
    const card = (title: string) => within(screen.getByRole('heading', { name: title }).closest('section') as HTMLElement);
    const dishes = card('Dishes');
    const preps = card('Preps');
    expect(dishes.getByRole('link', { name: 'Classic Burger' }).closest('li')?.textContent).toContain('€4.85');
    expect(dishes.queryByRole('link', { name: 'Burger Sauce' })).toBeNull();
    expect(preps.getByRole('link', { name: /Burger sauce/i })).toBeTruthy();
    expect(preps.getAllByRole('listitem')[0]?.textContent).toMatch(/€\d+\.\d\d\/kg/);
    expect(dishes.getByRole('link', { name: 'New dish' }).getAttribute('href')).toBe('#/recipe/new?kind=dish');
    expect(preps.getByRole('link', { name: 'New prep' }).getAttribute('href')).toBe('#/recipe/new?kind=prep');
  });

  it('is in the main menu', async () => {
    await open('#/recipes');
    expect(screen.getByRole('link', { name: 'Recipes' }).getAttribute('aria-current')).toBe('page');
  });
});

describe('Scenario 4: one sauce for a dish (the manual example from the architecture, section 6)', () => {
  it('creates a prep, then a dish using 150 g of it: the dish costs €0.27', async () => {
    const u = user();
    const storage = await open('#/recipe/new?kind=prep', storageWith(sauceDoc()));
    expect(screen.getByRole('heading', { level: 1, name: 'New prep' })).toBeTruthy();

    await u.type(screen.getByLabelText('Name'), 'Tomato sauce');
    await u.type(screen.getByLabelText(/One batch makes/), '1');
    await u.selectOptions(screen.getByLabelText('Batch unit'), 'kg');
    await fillLine(u, 1, 'ingredient:ing_tomato', '800');
    await u.click(screen.getByRole('button', { name: 'Add line' }));
    await fillLine(u, 2, 'ingredient:ing_spice', '20');

    expect(line(1).getByText('€1.60')).toBeTruthy();
    expect(line(2).getByText('€0.20')).toBeTruthy();
    expect(costOf('Batch cost, all portions (excl. VAT)')).toBe('€1.80');
    expect(costOf('Cost per kg, l or pc (excl. VAT)')).toBe('€1.80/kg');
    expect(costOf('One batch makes')).toBe('1 kg');

    await u.click(screen.getByRole('button', { name: 'Save prep' }));
    const prep = savedDocument(storage).recipes[0];
    expect(prep).toMatchObject({ kind: 'prep', name: 'Tomato sauce', outputMilli: 1_000_000, outputUnit: 'g' });
    expect(window.location.hash).toBe(`#/recipe/${prep?.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tomato sauce' })).toBeTruthy();

    // Now a dish that uses 150 g of the sauce.
    await go('#/recipe/new?kind=dish');
    await screen.findByRole('heading', { level: 1, name: 'New dish' });
    await u.type(screen.getByLabelText('Name'), 'Pasta');
    await u.type(screen.getByLabelText(/Menu price/), '16,50');
    await fillLine(u, 1, `prep:${prep?.id}`, '150');
    expect(line(1).getByText('€0.27')).toBeTruthy();
    expect(costOf('Batch cost, all portions (excl. VAT)')).toBe('€0.27');
    expect(costOf(/Recipe-based ingredient cost per portion/)).toBe('€0.27');
    expect(costOf('Price excl. VAT')).toBe('€15.14');
    expect(costOf(/Contribution per portion/)).toBe('€14.87');
    expect(costOf('Food cost %')).toBe('1.8%');
    expect(costOf('Contribution margin %')).toBe('98.2%');

    await u.click(screen.getByRole('button', { name: 'Save dish' }));
    const dish = savedDocument(storage).recipes.find((recipe) => recipe.kind === 'dish');
    expect(dish).toMatchObject({
      name: 'Pasta', menuPriceInclVatCents: 1650, vatRateBp: 900, portions: 1,
      lines: [{ ref: { kind: 'prep', id: prep?.id }, netQtyMilli: 150_000, yieldBp: 10_000 }],
    });
    expect(dish && 'monthlyVolume' in dish).toBe(false);
  });

  it('a new tomato price changes the dish through the sauce', async () => {
    const u = user();
    const doc = sauceDoc();
    doc.recipes = [
      { id: 'prep_sauce', name: 'Tomato sauce', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [
        { id: 'l1', ref: { kind: 'ingredient', id: 'ing_tomato' }, netQtyMilli: 800_000, yieldBp: 10_000 },
        { id: 'l2', ref: { kind: 'ingredient', id: 'ing_spice' }, netQtyMilli: 20_000, yieldBp: 10_000 },
      ] },
      { id: 'dish_pasta', name: 'Pasta', kind: 'dish', menuPriceInclVatCents: 1650, vatRateBp: 900, portions: 1, lines: [
        { id: 'p1', ref: { kind: 'prep', id: 'prep_sauce' }, netQtyMilli: 150_000, yieldBp: 10_000 },
      ] },
      { id: 'dish_soup', name: 'Soup', kind: 'dish', menuPriceInclVatCents: 700, vatRateBp: 900, portions: 1, lines: [
        { id: 's1', ref: { kind: 'prep', id: 'prep_sauce' }, netQtyMilli: 300_000, yieldBp: 10_000 },
      ] },
    ];
    await open('#/ingredients', storageWith(doc));
    await u.click(screen.getByRole('button', { name: 'New price for Tomatoes' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText(/Pack price/), '3');
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));

    // 800 g at €3.00/kg = €2.40, plus €0.20 spices = €2.60 per kg of sauce.
    await go('#/recipe/prep_sauce');
    await screen.findByRole('heading', { level: 1, name: 'Tomato sauce' });
    expect(costOf('Cost per kg, l or pc (excl. VAT)')).toBe('€2.60/kg');
    await go('#/recipe/dish_pasta');
    await screen.findByRole('heading', { level: 1, name: 'Pasta' });
    expect(costOf(/Recipe-based ingredient cost per portion/)).toBe('€0.39');
    await go('#/recipe/dish_soup');
    await screen.findByRole('heading', { level: 1, name: 'Soup' });
    expect(costOf(/Recipe-based ingredient cost per portion/)).toBe('€0.78');
  });
});

describe('Scenario 3: a new dish', () => {
  it('shows cost, contribution and food cost % as the owner types, including yield and portions', async () => {
    const u = user();
    const storage = await open('#/recipe/new?kind=dish', storageWith(sauceDoc()));
    await u.type(screen.getByLabelText('Name'), 'Pasta Bolognese');
    await u.type(screen.getByLabelText(/Menu price/), '16.50');
    expect(screen.getByLabelText('VAT rate')).toHaveProperty('value', '900'); // 9% is the default
    await u.clear(screen.getByLabelText('Portions per batch'));
    await u.type(screen.getByLabelText('Portions per batch'), '2');
    await u.type(screen.getByLabelText(/Monthly volume/), '300');
    expect(screen.getByText(/your estimate, not a forecast/i)).toBeTruthy();

    // 1 kg tomatoes at yield 80% costs 1000 / 0.8 g = €2.50 for €2.00 per kg.
    await fillLine(u, 1, 'ingredient:ing_tomato', '1', { unit: 'kg', yieldPct: '80' });
    expect(line(1).getByText('€2.50')).toBeTruthy();
    expect(costOf('Batch cost, all portions (excl. VAT)')).toBe('€2.50');
    expect(costOf(/Recipe-based ingredient cost per portion/)).toBe('€1.25');
    expect(costOf('Menu price (incl. VAT)')).toBe('€16.50');
    expect(costOf('Food cost %')).toBe('8.3%');
    expect(costOf(/Estimated monthly contribution/)).toMatch(/^€\d/);

    await u.click(screen.getByRole('button', { name: 'Save dish' }));
    expect(savedDocument(storage).recipes[0]).toMatchObject({
      portions: 2, monthlyVolume: 300, lines: [{ netQtyMilli: 1_000_000, yieldBp: 8000 }],
    });
  });

  it('a dish without lines, or with an ingredient without a price, says "cost unknown" and never €0.00', async () => {
    const u = user();
    await open('#/recipe/new?kind=dish', storageWith(sauceDoc()));
    await u.clear(screen.getByLabelText('Name'));
    await u.type(screen.getByLabelText('Name'), 'Saffron rice');
    await u.type(screen.getByLabelText(/Menu price/), '9');
    await u.click(within(screen.getByRole('group', { name: 'Line 1' })).getByRole('button', { name: /Remove/ }));
    expect(costOf(/Recipe-based ingredient cost per portion/)).toBe('cost unknown');
    expect(screen.getByText(/Add at least one ingredient or prep/)).toBeTruthy();

    await u.click(screen.getByRole('button', { name: 'Add line' }));
    await fillLine(u, 1, 'ingredient:ing_noprice', '2');
    expect(line(1).getByText('cost unknown')).toBeTruthy();
    expect(costOf('Food cost %')).toBe('cost unknown');
    expect(screen.getByText('No price yet for: Saffron.')).toBeTruthy();
    expect(summary().queryByText('€0.00')).toBeNull();
  });

  it('a menu price of zero shows n/a for the percentages', async () => {
    const u = user();
    await open('#/recipe/new?kind=dish', storageWith(sauceDoc()));
    await u.type(screen.getByLabelText('Name'), 'Free sample');
    await u.type(screen.getByLabelText(/Menu price/), '0');
    await fillLine(u, 1, 'ingredient:ing_tomato', '100');
    expect(costOf('Food cost %')).toBe('n/a');
    expect(costOf('Contribution margin %')).toBe('n/a');
  });

  it('offers the VAT rates 9%, 21% and 0%', async () => {
    await open('#/recipe/new?kind=dish');
    const options = within(screen.getByLabelText('VAT rate')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['9%', '21%', '0%']);
  });

  it('the unit follows what is chosen: weight, volume or pieces', async () => {
    const u = user();
    const doc = sauceDoc();
    doc.ingredients.push({ id: 'ing_milk', name: 'Milk', unit: 'ml', prices: [] }, { id: 'ing_egg', name: 'Egg', unit: 'pc', prices: [] });
    await open('#/recipe/new?kind=dish', storageWith(doc));
    const row = line(1);
    const units = () => within(row.getByLabelText('Unit')).getAllByRole('option').map((option) => option.textContent);
    await u.selectOptions(row.getByLabelText('Ingredient or prep'), 'ingredient:ing_milk');
    expect(units()).toEqual(['ml', 'l']);
    await u.selectOptions(row.getByLabelText('Ingredient or prep'), 'ingredient:ing_egg');
    expect(units()).toEqual(['pc']);
    expect((row.getByLabelText('Unit') as HTMLSelectElement).disabled).toBe(true);
    await u.selectOptions(row.getByLabelText('Ingredient or prep'), 'ingredient:ing_tomato');
    expect(units()).toEqual(['g', 'kg']);
  });
});

describe('Form errors', () => {
  it('shows every wrong field next to the field, focuses the first, writes nothing', async () => {
    const u = user();
    const storage = await open('#/recipe/new?kind=dish', storageWith(sauceDoc()));
    const before = storage.data.get(STORAGE_KEY);
    await u.type(screen.getByLabelText(/Menu price/), 'abc');
    await u.clear(screen.getByLabelText('Portions per batch'));
    await u.type(screen.getByLabelText('Portions per batch'), '0');
    await u.click(screen.getByRole('button', { name: 'Save dish' }));

    const describedBy = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '')?.textContent;
    const name = screen.getByLabelText('Name');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(name)).toBe('Enter a name.');
    expect(describedBy(screen.getByLabelText(/Menu price/))).toMatch(/non-negative amount/);
    expect(describedBy(screen.getByLabelText('Portions per batch'))).toMatch(/whole number of portions/);
    expect(describedBy(line(1).getByLabelText('Ingredient or prep'))).toBe('Choose an ingredient or a prep.');
    expect(describedBy(line(1).getByLabelText(/Net quantity/))).toMatch(/Enter a quantity/);
    expect(document.activeElement).toBe(name);
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent).join(' ')).toMatch(/need attention/);
    expect(storage.data.get(STORAGE_KEY)).toBe(before);
    expect(window.location.hash).toBe('#/recipe/new?kind=dish');
  });

  it('rejects yield 0 and above 100, and a quantity with too many decimals', async () => {
    const u = user();
    await open('#/recipe/new?kind=dish', storageWith(sauceDoc()));
    await u.type(screen.getByLabelText('Name'), 'X');
    await u.type(screen.getByLabelText(/Menu price/), '5');
    await fillLine(u, 1, 'ingredient:ing_tomato', '1.234', { yieldPct: '0' });
    await u.click(screen.getByRole('button', { name: 'Save dish' }));
    expect(line(1).getByLabelText(/Net quantity/).getAttribute('aria-invalid')).toBe('true');
    expect(line(1).getByLabelText('Yield %').getAttribute('aria-invalid')).toBe('true');
    await u.clear(line(1).getByLabelText('Yield %'));
    await u.type(line(1).getByLabelText('Yield %'), '101');
    expect(line(1).getByText(/from 0\.01 to 100 percent/)).toBeTruthy();
  });

  it('a failed write keeps everything typed and the saved data unchanged', async () => {
    const u = user();
    const storage = await open('#/recipe/new?kind=dish', storageWith(sauceDoc()));
    const before = storage.data.get(STORAGE_KEY);
    await u.type(screen.getByLabelText('Name'), 'Pasta');
    await u.type(screen.getByLabelText(/Menu price/), '12');
    await fillLine(u, 1, 'ingredient:ing_tomato', '200');
    storage.failOnSet = new Error('disk is full');
    await u.click(screen.getByRole('button', { name: 'Save dish' }));

    const alert = screen.getByText(/could not be saved/i);
    expect(alert.textContent).toMatch(/disk is full.*Your changes are still here, nothing was saved/);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Pasta');
    expect((line(1).getByLabelText(/Net quantity/) as HTMLInputElement).value).toBe('200');
    expect(storage.data.get(STORAGE_KEY)).toBe(before);
    expect(window.location.hash).toBe('#/recipe/new?kind=dish');
    // Said once, next to the Save button; the page banner stays quiet.
    expect(screen.getAllByText(/could not be saved/i)).toHaveLength(1);

    storage.failOnSet = null;
    await u.click(screen.getByRole('button', { name: 'Save dish' }));
    expect(savedDocument(storage).recipes[0]?.name).toBe('Pasta');
  });
});

describe('Preps inside preps', () => {
  const twoPreps = () => {
    const doc = sauceDoc();
    doc.recipes = [
      { id: 'prep_a', name: 'Sauce A', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [
        { id: 'a1', ref: { kind: 'ingredient', id: 'ing_tomato' }, netQtyMilli: 500_000, yieldBp: 10_000 },
      ] },
      { id: 'prep_b', name: 'Sauce B', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [
        { id: 'b1', ref: { kind: 'prep', id: 'prep_a' }, netQtyMilli: 200_000, yieldBp: 10_000 },
      ] },
    ];
    return doc;
  };

  it('a prep cannot choose itself in the list', async () => {
    await open('#/recipe/prep_a', storageWith(twoPreps()));
    const options = within(line(1).getByLabelText('Ingredient or prep')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toContain('Sauce B · g');
    expect(options).not.toContain('Sauce A · g');
  });

  it('a loop between preps is refused with a clear message; the draft and the data stay', async () => {
    const u = user();
    const storage = await open('#/recipe/prep_a', storageWith(twoPreps()));
    const before = storage.data.get(STORAGE_KEY);
    await u.click(screen.getByRole('button', { name: 'Add line' }));
    await fillLine(u, 2, 'prep:prep_b', '100');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));

    const alert = screen.getAllByRole('alert').map((entry) => entry.textContent).join(' ');
    expect(alert).toMatch(/preps use each other in a loop \(Sauce A uses Sauce B uses Sauce A\)/);
    expect(alert).toMatch(/nothing was saved/);
    expect(line(2).getByLabelText(/Net quantity/)).toHaveProperty('value', '100');
    expect(storage.data.get(STORAGE_KEY)).toBe(before);
  });

  it('too deep a nesting is refused with a clear message', async () => {
    const u = user();
    const doc = sauceDoc();
    const base = { kind: 'prep' as const, outputMilli: 1_000_000, outputUnit: 'g' as const };
    // p1 uses p2 ... p5 uses tomatoes: five levels.
    doc.recipes = [1, 2, 3, 4, 5].map((n) => ({
      ...base, id: `p${n}`, name: `Prep ${n}`,
      lines: [{ id: `l${n}`, ref: n < 5 ? { kind: 'prep' as const, id: `p${n + 1}` } : { kind: 'ingredient' as const, id: 'ing_tomato' }, netQtyMilli: 100_000, yieldBp: 10_000 }],
    }));
    await open('#/recipe/new?kind=prep', storageWith(doc));
    await u.type(screen.getByLabelText('Name'), 'Too deep');
    await u.type(screen.getByLabelText(/One batch makes/), '1');
    await fillLine(u, 1, 'prep:p1', '100');
    await u.click(screen.getByRole('button', { name: 'Save prep' }));
    expect(screen.getByText(/at most 5 levels deep/)).toBeTruthy();
  });

  it('the output unit of a prep that dishes use stays weight, volume or pieces', async () => {
    const doc = twoPreps();
    await open('#/recipe/prep_a', storageWith(doc));
    const units = within(screen.getByLabelText('Batch unit')).getAllByRole('option').map((option) => option.textContent);
    expect(units).toEqual(['g', 'kg']);
    expect(screen.getByText(/cannot change/)).toBeTruthy();
  });
});

describe('Editing a saved recipe', () => {
  it('changing the menu price updates the cost view, can be discarded, and saving persists it', async () => {
    const u = user();
    const storage = await open('#/recipe/dish_classic_burger');
    expect(costOf(/Recipe-based ingredient cost per portion/)).toBe('€4.85');
    expect(costOf('Price excl. VAT')).toBe('€12.00');
    expect(costOf(/Contribution per portion/)).toBe('€7.15');

    const price = screen.getByLabelText(/Menu price/);
    await u.clear(price);
    await u.type(price, '14.17');
    expect(screen.getByText('You have unsaved changes.')).toBeTruthy();
    expect(costOf('Price excl. VAT')).toBe('€13.00');
    await u.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(price).toHaveProperty('value', '13.08');
    expect(costOf('Price excl. VAT')).toBe('€12.00');

    await u.clear(price);
    await u.type(price, '14.17');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Saved.')).toBeTruthy();
    expect(savedDocument(storage).recipes.find((recipe) => recipe.id === 'dish_classic_burger')).toMatchObject({ menuPriceInclVatCents: 1417 });
  });

  it('keeps the ids of existing lines, so saved simulator scenarios keep working', async () => {
    const u = user();
    const storage = await open('#/recipe/dish_classic_burger');
    const idsBefore = demoCopy().recipes.find((recipe) => recipe.id === 'dish_classic_burger')?.lines.map((entry) => entry.id);
    expect(idsBefore?.length).toBeGreaterThan(0);
    await u.clear(screen.getByLabelText('Name'));
    await u.type(screen.getByLabelText('Name'), 'Classic Burger XL');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    const after = savedDocument(storage).recipes.find((recipe) => recipe.id === 'dish_classic_burger');
    expect(after?.name).toBe('Classic Burger XL');
    expect(after?.lines.map((entry) => entry.id)).toEqual(idsBefore);
  });

  it('keeps data after the page is reloaded (same storage, new session)', async () => {
    const u = user();
    const storage = memoryStorage();
    const first = renderApp(storage);
    await go('#/recipe/dish_classic_burger');
    await screen.findByRole('heading', { level: 1, name: 'Classic Burger' });
    await u.clear(screen.getByLabelText('Name'));
    await u.type(screen.getByLabelText('Name'), 'Burger Deluxe');
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    first.unmount();

    renderApp(storage);
    await go('#/recipe/dish_classic_burger');
    expect(await screen.findByRole('heading', { level: 1, name: 'Burger Deluxe' })).toBeTruthy();
  });

  it('shows the lines of a stored dish with the quantity in the typed unit', async () => {
    await open('#/recipe/dish_classic_burger');
    const beefLine = within(screen.getByDisplayValue('180').closest('[role="group"]') as HTMLElement);
    expect(beefLine.getByLabelText('Ingredient or prep')).toHaveProperty('value', 'ingredient:ing_beef');
    expect(beefLine.getByLabelText('Unit')).toHaveProperty('value', 'g');
    expect(beefLine.getByText('€3.06')).toBeTruthy(); // 180 g at €17.00/kg
  });
});

describe('Deleting a recipe', () => {
  it('a prep that is used cannot be deleted: the dialog explains where it is used', async () => {
    const u = user();
    const storage = await open('#/recipe/prep_burger_sauce');
    const before = storage.data.get(STORAGE_KEY);
    await u.click(screen.getByRole('button', { name: 'Delete prep' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Delete Burger sauce/i });
    await u.click(within(dialog).getByRole('button', { name: 'Delete prep' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/Cannot delete .*it is used by/);
    expect(within(dialog).getByText('Remove it from these recipes first:')).toBeTruthy();
    expect(within(dialog).getAllByRole('link').length).toBeGreaterThan(0);
    expect(storage.data.get(STORAGE_KEY)).toBe(before);
  });

  it('a dish with saved scenarios asks first, then deletes the dish and its scenarios', async () => {
    const u = user();
    const doc = demoCopy();
    const snapshot = createBaselineSnapshot(doc as unknown as MenuDocument, 'dish_classic_burger', '2026-10-18T12:00:00.000Z');
    doc.scenarios = [{
      id: 'scn_1', recipeId: 'dish_classic_burger', name: 'Price +€0.75', createdAt: '2026-10-18T12:00:00.000Z',
      baseline: JSON.parse(JSON.stringify(snapshot)), overrides: { menuPriceInclVatCents: 1383 },
    }] as typeof doc.scenarios;
    const storage = await open('#/recipe/dish_classic_burger', storageWith(doc));
    await u.click(screen.getByRole('button', { name: 'Delete dish' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/This dish has 1 saved simulator scenario\. They will be deleted too/);
    expect(within(dialog).getByText('Price +€0.75')).toBeTruthy();
    expect(savedDocument(storage).scenarios).toHaveLength(1); // nothing happens before the confirmation

    await u.click(within(dialog).getByRole('button', { name: 'Delete dish and its 1 scenario' }));
    const saved = savedDocument(storage);
    expect(saved.recipes.find((recipe) => recipe.id === 'dish_classic_burger')).toBeUndefined();
    expect(saved.scenarios).toEqual([]);
    expect(window.location.hash).toBe('#/recipes');
    expect(await screen.findByRole('heading', { level: 1, name: 'Recipes' })).toBeTruthy();
    expect(screen.queryByText('Not found')).toBeNull();
  });

  it('cancelling the dialog keeps the dish and returns focus to the Delete button', async () => {
    const u = user();
    const storage = await open('#/recipe/dish_fries');
    const opener = screen.getByRole('button', { name: 'Delete dish' });
    await u.click(opener);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(opener);
    expect(storage.data.has(STORAGE_KEY)).toBe(false); // nothing was written
    expect(screen.getByRole('heading', { level: 1, name: 'Fries with Burger Sauce' })).toBeTruthy();
  });

  it('a dish without scenarios is deleted after one confirmation', async () => {
    const u = user();
    const storage = await open('#/recipe/dish_fries');
    await u.click(screen.getByRole('button', { name: 'Delete dish' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).not.toMatch(/scenario/);
    await u.click(within(dialog).getByRole('button', { name: 'Delete dish' }));
    expect(savedDocument(storage).recipes.some((recipe) => recipe.id === 'dish_fries')).toBe(false);
    expect(await screen.findByRole('heading', { level: 1, name: 'Recipes' })).toBeTruthy();
  });
});
