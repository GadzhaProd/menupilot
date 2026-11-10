import { expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, demoCopy, memoryStorage, STORAGE_KEY } from './helpers';
import { dishRows } from '@/ui/domain/calc';
import type { MenuDocument } from '@/ui/domain/types';

type MutableMenuDocument = Omit<MenuDocument, 'recipes' | 'ingredients'> & {
  recipes: MenuDocument['recipes'][number][];
  ingredients: MenuDocument['ingredients'][number][];
};

it('shows the fixture food cost in the food-cost field and labels it excl. VAT', async () => {
  const doc = demoCopy();
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) });
  await renderApp(storage);
  window.location.hash = '#/recipes';
  const burger = await screen.findByRole('link', { name: 'Classic Burger' });
  const row = burger.closest('li');
  expect(row).not.toBeNull();
  expect(within(row as HTMLElement).getByTestId('dish-food-cost').textContent).toContain('40.4%');
  expect(screen.getByRole('button', { name: 'Food cost % (excl. VAT), Sort by food cost ascending' })).toBeTruthy();
});

it('shows cost unknown when a dish has no ingredient prices', async () => {
  const doc = demoCopy();
  doc.ingredients = doc.ingredients.map((ingredient) => ({ ...ingredient, prices: [] }));
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) });
  await renderApp(storage);
  window.location.hash = '#/recipes';
  const burger = await screen.findByRole('link', { name: 'Classic Burger' });
  const row = burger.closest('li');
  expect(row).not.toBeNull();
  expect(within(row as HTMLElement).getByTestId('dish-food-cost').textContent).toContain('cost unknown');
  expect(row?.textContent).not.toMatch(/Cost:\s*cost unknown/);
});

it('shows n/a with the zero-price hint when menu price is zero', async () => {
  const doc = demoCopy() as unknown as MutableMenuDocument;
  doc.recipes = doc.recipes.map((recipe) => recipe.id === 'dish_classic_burger' && recipe.kind === 'dish'
    ? { ...recipe, menuPriceInclVatCents: 0 }
    : recipe);
  await renderApp(memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) }));
  window.location.hash = '#/recipes';
  const burger = await screen.findByRole('link', { name: 'Classic Burger' });
  const row = burger.closest('li');
  expect(row).not.toBeNull();
  const foodCost = within(row as HTMLElement).getByTestId('dish-food-cost');
  expect(foodCost.textContent).toContain('n/a');
  expect(foodCost.querySelector('[title]')?.getAttribute('title')).toBe('The menu price is €0.00, so a percentage makes no sense.');
});

it('sorts food cost in either direction and keeps unknown costs last', async () => {
  const doc = demoCopy() as unknown as MutableMenuDocument;
  const burger = doc.recipes.find((recipe) => recipe.id === 'dish_classic_burger');
  if (!burger || burger.kind !== 'dish') throw new Error('Expected demo burger dish');
  doc.recipes.push(
    { ...burger, id: 'dish_zero_cost', name: 'Zero food cost', menuPriceInclVatCents: 1200, lines: [] },
    { ...burger, id: 'dish_unknown_cost', name: 'Unknown cost dish', menuPriceInclVatCents: 1200, lines: [{ id: 'unknown-line', ref: { kind: 'ingredient', id: 'ing_no_price' }, netQtyMilli: 1000, yieldBp: 10000 }] },
  );
  const sourceIngredient = doc.ingredients[0];
  if (!sourceIngredient) throw new Error('Expected demo ingredient');
  doc.ingredients.push({ ...sourceIngredient, id: 'ing_no_price', name: 'No price ingredient', prices: [] });
  const expectedByFoodCost = dishRows(doc).filter((dish) => dish.foodCostTenthsPct !== null);
  const expectedAscending = [...expectedByFoodCost].sort((a, b) => a.foodCostTenthsPct! < b.foodCostTenthsPct! ? -1 : a.foodCostTenthsPct! > b.foodCostTenthsPct! ? 1 : 0).map((dish) => dish.name);
  const expectedDescending = [...expectedByFoodCost].sort((a, b) => a.foodCostTenthsPct! > b.foodCostTenthsPct! ? -1 : a.foodCostTenthsPct! < b.foodCostTenthsPct! ? 1 : 0).map((dish) => dish.name);
  await renderApp(memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) }));
  window.location.hash = '#/recipes';
  await screen.findByRole('link', { name: 'Classic Burger' });
  const sort = screen.getByRole('button', { name: 'Food cost % (excl. VAT), Sort by food cost ascending' });
  await userEvent.click(sort);
  let rows = screen.getAllByRole('listitem').filter((item) => item.querySelector('[data-testid="dish-food-cost"]'));
  expect(rows.slice(0, expectedAscending.length).map((row) => within(row).getByRole('link').textContent)).toEqual(expectedAscending);
  expect(within(rows.at(-1)!).getByTestId('dish-food-cost').textContent).toContain('cost unknown');
  await userEvent.click(screen.getByRole('button', { name: 'Food cost % (excl. VAT), Sort by food cost descending' }));
  rows = screen.getAllByRole('listitem').filter((item) => item.querySelector('[data-testid="dish-food-cost"]'));
  expect(rows.slice(0, expectedDescending.length).map((row) => within(row).getByRole('link').textContent)).toEqual(expectedDescending);
  expect(within(rows.at(-1)!).getByTestId('dish-food-cost').textContent).toContain('cost unknown');
});
