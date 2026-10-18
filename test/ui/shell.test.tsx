import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, demoCopy, memoryStorage, renderApp } from './helpers';

describe('Dashboard', () => {
  it('lists the demo dishes with cost and contribution from src/calc', () => {
    renderApp();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Recipe-based ingredient cost \(excl\. VAT\)/ })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: /Contribution \(before other costs\)/ })).toBeTruthy();

    const rowCells = (name: string) => {
      const row = within(table).getByRole('link', { name }).closest('tr') as HTMLElement;
      return within(row).getAllByRole('cell').map((cell) => cell.textContent);
    };
    // Same numbers as the store demo test: cost €4.85, contribution €7.15 (price €12.00 excl. VAT).
    expect(rowCells('Classic Burger')).toEqual(['Classic Burger', '€13.08', '€12.00', '€4.85', '€7.15']);
    expect(rowCells('House Red Wine (glass)')).toEqual(['House Red Wine (glass)', '€6.50', '€5.37', '€1.32', '€4.05']);
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 5);
  });

  it('shows "cost unknown" instead of zero when an ingredient has no price', () => {
    const doc = demoCopy();
    const beef = doc.ingredients.find((ingredient) => ingredient.id === 'ing_beef');
    if (beef) beef.prices = [];
    renderApp(memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) }));

    const row = screen.getByRole('link', { name: 'Classic Burger' }).closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual(['Classic Burger', '€13.08', '€12.00', 'cost unknown', '—']);
    // Dishes that do not use beef are still calculated.
    expect(within(screen.getByRole('link', { name: 'Tomato Soup' }).closest('tr') as HTMLElement).getAllByRole('cell')[3]?.textContent).toBe('€0.56');
  });
});

describe('Shell', () => {
  it('has landmarks, a skip link and a labelled main navigation', () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
  });

  it('moves focus to the page content after navigating, and updates the title', async () => {
    renderApp();
    expect(document.activeElement).toBe(document.body);
    await userEvent.click(screen.getByRole('link', { name: 'Ingredients' }));
    await screen.findByRole('heading', { level: 1, name: 'Ingredients' });
    expect(document.activeElement).toBe(screen.getByRole('main'));
    expect(document.title).toBe('Ingredients · MenuPilot');
  });

  it('the skip link focuses the main content', async () => {
    renderApp();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to content' }));
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });
});
