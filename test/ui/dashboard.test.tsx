import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from './helpers';

beforeEach(() => {
  window.location.hash = '';
});

function dishTable() {
  return screen.getByRole('table', { name: 'Dish cost comparison' });
}

function dishRow(name: string) {
  const table = dishTable();
  return within(table).getByRole('link', { name }).closest('tr') as HTMLElement;
}

function dishCells(name: string): string[] {
  return within(dishRow(name)).getAllByRole('cell').map((cell) => cell.textContent ?? '');
}

describe('Dashboard date comparison', () => {
  it('switches between 7, 30 and 90 day comparisons and accepts a custom date', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: '7 days' }));
    expect(dishCells('Classic Burger').slice(3, 6)).toEqual([
      '€4.85', '€4.85', '€0.00',
    ]);
    expect(dishCells('Classic Burger')[8]).toBe('€0.00');

    await user.click(screen.getByRole('button', { name: '30 days' }));
    expect(dishCells('Classic Burger').slice(3, 5)).toEqual(['€4.20', '€4.85']);
    expect(dishCells('Classic Burger')[8]).toBe('-€195.00');

    await user.click(screen.getByRole('button', { name: '90 days' }));
    expect(screen.getByRole('button', { name: '90 days' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(dishCells('Classic Burger').slice(3, 6)).toEqual([
      'no price on this date', '€4.85', 'no price on this date',
    ]);

    const datePicker = screen.getByLabelText('Comparison date');
    fireEvent.change(datePicker, { target: { value: '2026-10-11' } });
    expect(dishCells('Classic Burger').slice(3, 5)).toEqual(['€4.85', '€4.85']);
  });

  it('shows recipe and simulator links for a dish', () => {
    renderApp();
    const table = dishTable();
    const burgerRow = within(table).getByRole('row', { name: /Classic Burger/ });

    expect(within(burgerRow).getByRole('link', { name: 'Classic Burger' })
      .getAttribute('href')).toBe('#/recipe/dish_classic_burger');
    expect(within(burgerRow).getByRole('link', { name: 'Simulate' })
      .getAttribute('href')).toBe('#/simulator/dish_classic_burger');
  });

  it('renders the same cost and impact values in the mobile dish cards', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: '30 days' }));

    const burgerCards = screen.getAllByRole('article').filter((article) =>
      within(article).queryByRole('link', { name: 'Classic Burger' }),
    );
    expect(burgerCards).toHaveLength(1);
    expect(within(burgerCards[0]!).getByText('€4.20')).toBeTruthy();
    expect(within(burgerCards[0]!).getByText('€4.85')).toBeTruthy();
    expect(within(burgerCards[0]!).getByText('-€195.00')).toBeTruthy();
  });
});
