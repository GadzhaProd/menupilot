import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  go, memoryStorage, renderApp, savedDocument, sauceDoc, storageWith, STORAGE_KEY,
} from './helpers';

const user = () => userEvent.setup();

async function openIngredients(storage = memoryStorage()) {
  renderApp(storage);
  await go('#/ingredients');
  await screen.findByRole('heading', { level: 1, name: 'Ingredients' });
  return storage;
}

const rowOf = (name: string) => screen.getByText(name, { selector: 'td' }).closest('tr') as HTMLElement;
const cellTexts = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent ?? '');

beforeEach(() => { window.location.hash = ''; });

describe('Ingredients list', () => {
  it('shows unit, pack, pack price, price per kg/l/pc and the date of the last price', async () => {
    await openIngredients();
    const cells = cellTexts(rowOf('Beef mince 80/20'));
    expect(cells.slice(0, 5)).toEqual(['Beef mince 80/20', 'g', '1 kg', '€17.00', '€17.00/kg']);
    expect(cells[5]).toMatch(/^\d{1,2} \w{3} 2026$/);
    // 12 buns for €10.56 excl. VAT, shown per piece.
    expect(cellTexts(rowOf('Brioche burger bun')).slice(0, 5)).toEqual(['Brioche burger bun', 'pc', '12 pc', '€10.56', '€0.88/pc']);
    expect(screen.getByText(/Supplier price excl\. VAT, as on the invoice/)).toBeTruthy();
  });

  it('shows what is missing for an ingredient without a price', async () => {
    await openIngredients(storageWith(sauceDoc()));
    expect(within(rowOf('Saffron')).getByText(/No price yet/)).toBeTruthy();
  });
});

describe('Add ingredient', () => {
  it('adds an ingredient, shows the price per kg live, saves it and lists it', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add ingredient' });

    await u.type(within(dialog).getByLabelText('Name'), 'Mozzarella');
    await u.type(within(dialog).getByLabelText('Pack size'), '250');
    await u.selectOptions(within(dialog).getByLabelText('Unit'), 'g');
    await u.type(within(dialog).getByLabelText(/Pack price/), '2,80');
    expect(within(dialog).getByText(/Supplier price excl\. VAT, as on the invoice/)).toBeTruthy();
    expect(dialog.textContent).toContain('€11.20/kg');

    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cellTexts(rowOf('Mozzarella')).slice(0, 5)).toEqual(['Mozzarella', 'g', '250 g', '€2.80', '€11.20/kg']);
    const saved = savedDocument(storage).ingredients.find((entry) => entry.name === 'Mozzarella');
    // The pack price and size are stored as typed, not rewritten to per-kg.
    expect(saved).toMatchObject({ unit: 'g', prices: [{ seq: 1, packPriceCents: 280, packSizeMilli: 250_000 }] });
  });

  it('converts litres and pieces to the stored base unit', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Name'), 'Milk');
    await u.type(within(dialog).getByLabelText('Pack size'), '1.5');
    await u.selectOptions(within(dialog).getByLabelText('Unit'), 'l');
    await u.type(within(dialog).getByLabelText(/Pack price/), '1.65');
    expect(dialog.textContent).toContain('€1.10/l');
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));
    expect(savedDocument(storage).ingredients.at(-1)).toMatchObject({ name: 'Milk', unit: 'ml', prices: [{ packSizeMilli: 1_500_000, packPriceCents: 165 }] });
  });

  it('can add an ingredient without a price', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Name'), 'Truffle');
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));
    expect(savedDocument(storage).ingredients.at(-1)).toMatchObject({ name: 'Truffle', prices: [] });
    expect(within(rowOf('Truffle')).getByText(/No price yet/)).toBeTruthy();
  });

  it('shows errors next to the fields, keeps the dialog and the typed values, and focuses the first problem', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    const before = storage.data.get(STORAGE_KEY);
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Pack size'), '0');
    await u.type(within(dialog).getByLabelText(/Pack price/), '-2');
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));

    const name = within(dialog).getByLabelText('Name');
    const size = within(dialog).getByLabelText('Pack size');
    const price = within(dialog).getByLabelText(/Pack price/);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(name.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Enter a name.');
    expect(document.getElementById(size.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '')?.textContent).toMatch(/greater than zero/);
    expect(document.getElementById(price.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '')?.textContent).toMatch(/non-negative/);
    expect(document.activeElement).toBe(name);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect((size as HTMLInputElement).value).toBe('0');
    expect(storage.data.get(STORAGE_KEY)).toBe(before); // nothing was written

    // Errors update as the owner fixes the fields.
    await u.type(name, 'Pepper');
    expect(name.getAttribute('aria-invalid')).toBeNull();
  });

  it('a failed write keeps the dialog and the typed values, and the list stays as it was', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Name'), 'Basil');
    await u.type(within(dialog).getByLabelText('Pack size'), '100');
    await u.selectOptions(within(dialog).getByLabelText('Unit'), 'g');
    await u.type(within(dialog).getByLabelText(/Pack price/), '1.50');
    storage.failOnSet = new Error('disk is full');
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));

    expect(within(dialog).getByRole('alert').textContent).toMatch(/could not be saved.*disk is full.*previous data is unchanged/i);
    expect((within(dialog).getByLabelText('Name') as HTMLInputElement).value).toBe('Basil');
    expect(screen.queryByText('Basil', { selector: 'td' })).toBeNull();

    storage.failOnSet = null;
    await u.click(within(dialog).getByRole('button', { name: 'Add ingredient' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(rowOf('Basil')).toBeTruthy();
  });
});

describe('New price and history', () => {
  it('appends a price to the history and keeps the old one', async () => {
    const u = user();
    const storage = await openIngredients();
    await u.click(screen.getByRole('button', { name: 'New price for Beef mince 80/20' }));
    const dialog = await screen.findByRole('dialog', { name: /New price: Beef mince/ });
    // The last pack size is filled in already; only the price is new.
    expect((within(dialog).getByLabelText('Pack size') as HTMLInputElement).value).toBe('1');
    expect(dialog.textContent).toContain('Now: €17.00 excl. VAT for 1 kg');
    await u.type(within(dialog).getByLabelText(/Pack price/), '19,50');
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cellTexts(rowOf('Beef mince 80/20')).slice(3, 5)).toEqual(['€19.50', '€19.50/kg']);
    const prices = savedDocument(storage).ingredients.find((entry) => entry.id === 'ing_beef')?.prices ?? [];
    expect(prices.map((price) => price.packPriceCents)).toEqual([1400, 1700, 1950]);
    expect(prices.map((price) => price.seq)).toEqual([1, 2, 3]);

    await u.click(screen.getByRole('button', { name: 'Price history of Beef mince 80/20' }));
    const history = await screen.findByRole('dialog', { name: /Price history/ });
    const rows = within(history).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[2]?.textContent)).toEqual(['€19.50', '€17.00', '€14.00']);
    expect(within(rows[0] as HTMLElement).getByText('current')).toBeTruthy();
  });

  it('a pack in a different size is a different record, per-kg price follows', async () => {
    const u = user();
    const storage = await openIngredients();
    await u.click(screen.getByRole('button', { name: 'New price for Beef mince 80/20' }));
    const dialog = await screen.findByRole('dialog');
    await u.clear(within(dialog).getByLabelText('Pack size'));
    await u.type(within(dialog).getByLabelText('Pack size'), '500');
    await u.selectOptions(within(dialog).getByLabelText('Unit'), 'g');
    await u.type(within(dialog).getByLabelText(/Pack price/), '9');
    expect(dialog.textContent).toContain('€18.00/kg');
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(savedDocument(storage).ingredients.find((entry) => entry.id === 'ing_beef')?.prices.at(-1)).toMatchObject({ packPriceCents: 900, packSizeMilli: 500_000 });
  });

  it('offers only units of the same kind and rejects an empty price next to its field', async () => {
    const u = user();
    await openIngredients();
    await u.click(screen.getByRole('button', { name: 'New price for Beef mince 80/20' }));
    const dialog = await screen.findByRole('dialog');
    const options = within(within(dialog).getByLabelText('Unit')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['g', 'kg']);
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));
    expect(within(dialog).getByLabelText(/Pack price/).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(within(dialog).getByLabelText(/Pack price/));
  });
});

describe('Rename and delete', () => {
  it('renames an ingredient', async () => {
    const u = user();
    const storage = await openIngredients();
    await u.click(screen.getByRole('button', { name: 'Rename Beef mince 80/20' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Name');
    await u.clear(input);
    await u.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await u.type(input, 'Beef mince');
    await u.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(rowOf('Beef mince')).toBeTruthy();
    expect(savedDocument(storage).ingredients.find((entry) => entry.id === 'ing_beef')?.name).toBe('Beef mince');
  });

  it('an ingredient used in recipes cannot be deleted: the message says where it is used', async () => {
    const u = user();
    const storage = await openIngredients();
    const before = storage.data.get(STORAGE_KEY);
    await u.click(screen.getByRole('button', { name: 'Delete Beef mince 80/20' }));
    const dialog = await screen.findByRole('alertdialog', { name: /Delete Beef mince/ });
    await u.click(within(dialog).getByRole('button', { name: 'Delete ingredient' }));

    expect(within(dialog).getByRole('alert').textContent).toMatch(/Cannot delete 'Beef mince 80\/20': it is used by .*Classic Burger/);
    const links = within(dialog).getAllByRole('link').map((link) => link.textContent);
    expect(links).toContain('Classic Burger');
    expect(within(dialog).getByRole('link', { name: 'Classic Burger' }).getAttribute('href')).toBe('#/recipe/dish_classic_burger');
    expect(storage.data.get(STORAGE_KEY)).toBe(before);
    expect(rowOf('Beef mince 80/20')).toBeTruthy();
  });

  it('deletes an ingredient nothing uses, and focus goes back to the page', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    await u.click(screen.getByRole('button', { name: 'Delete Saffron' }));
    const dialog = await screen.findByRole('alertdialog');
    await u.click(within(dialog).getByRole('button', { name: 'Delete ingredient' }));
    expect(screen.queryByText('Saffron', { selector: 'td' })).toBeNull();
    expect(savedDocument(storage).ingredients.map((entry) => entry.name)).toEqual(['Tomatoes', 'Spice mix']);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });
});

describe('Dialog keyboard behaviour', () => {
  it('moves focus into the dialog, keeps Tab inside it, closes on Escape and returns focus to the button', async () => {
    const u = user();
    await openIngredients();
    const opener = screen.getByRole('button', { name: 'Add ingredient' });
    await u.click(opener);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    for (let index = 0; index < 12; index += 1) {
      await u.tab();
      expect(dialog.contains(document.activeElement), `after ${index + 1} tabs`).toBe(true);
    }
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(opener);
  });

  it('works without a mouse: Enter on the opener opens, Enter in a field submits', async () => {
    const u = user();
    const storage = await openIngredients(storageWith(sauceDoc()));
    screen.getByRole('button', { name: 'Add ingredient' }).focus();
    await u.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText('Name'), 'Oregano{Enter}');
    expect(savedDocument(storage).ingredients.at(-1)?.name).toBe('Oregano');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
