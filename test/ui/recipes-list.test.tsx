import { expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, demoCopy, memoryStorage, STORAGE_KEY } from './helpers';
import { dishRows, formatPercentTenthsLocale } from '@/ui/domain/calc';
import type { MenuDocument } from '@/ui/domain/types';

it('shows each dish food cost using its recipe metrics and labels it excl. VAT', async () => {
  const doc = demoCopy();
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) });
  await renderApp(storage);
  window.location.hash = '#/recipes';
  const burger = await screen.findByRole('link', { name: 'Classic Burger' });
  const row = burger.closest('li');
  expect(row).not.toBeNull();
  const typedDoc = doc as MenuDocument;
  const expected = dishRows(typedDoc).find((entry) => entry.id === 'dish_classic_burger');
  expect(expected).toBeDefined();
  expect(within(row as HTMLElement).getByText(formatPercentTenthsLocale(expected!.foodCostTenthsPct, 'en'))).toBeTruthy();
  expect(screen.getByText('Food cost % (excl. VAT)', { exact: true })).toBeTruthy();
});

it('shows cost unknown when a dish has no ingredient prices', async () => {
  const doc = demoCopy();
  doc.ingredients = doc.ingredients.map((ingredient) => ({ ...ingredient, prices: [] }));
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) });
  await renderApp(storage);
  window.location.hash = '#/recipes';
  await screen.findByRole('link', { name: 'Classic Burger' });
  expect(screen.getAllByText('cost unknown', { exact: true }).length).toBeGreaterThan(0);
});
