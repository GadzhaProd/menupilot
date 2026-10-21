import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from './helpers';
import { dashboardData, largestCostIncrease } from '@/ui/domain/dashboard';
import demo from '../../data/demo.json';

describe('C+ dashboard', () => {
  it('chooses the largest positive comparable per-portion increase, preserves ties and ignores volume', () => {
    const rows = dashboardData(demo as never, '2026-09-18T23:59:59.999Z').dishes;
    const first = { ...rows[0]!, costDeltaCents: 100n, monthlyVolume: null };
    const tied = { ...rows[1]!, costDeltaCents: 100n };
    expect(largestCostIncrease([first, tied])?.dish.id).toBe(first.id);
    expect(largestCostIncrease([first, tied])?.tied).toBe(true);
    expect(largestCostIncrease([{ ...first, costDeltaCents: 0n }])).toBeNull();
    expect(largestCostIncrease([{ ...first, status: 'no-price-on-date' }])).toBeNull();
  });
  it('translates the question, comparison and figures without translating dish names', async () => {
    const user = userEvent.setup();
    (await renderApp());
    await user.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    expect(screen.getByRole('heading', { name: 'Wat is er veranderd aan je menu?' })).toBeTruthy();
    expect(screen.getByText('Grootste stijging per portie')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Vergelijking van gerechtkosten' });
    expect(within(table).getByRole('link', { name: 'Classic Burger' })).toBeTruthy();
    expect(table.textContent).toContain('€ 4,85');
  });
});

it('shows actual excluded reasons in Dutch, names missing volume and highlights the largest increase', async () => {
  const user = userEvent.setup(); (await renderApp());
  await user.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
  const table = screen.getByRole('table', { name: 'Vergelijking van gerechtkosten' });
  expect(within(table).getByRole('link', { name: 'Classic Burger' }).closest('tr')?.className).toContain('bg-panel');
  expect(within(table).getByRole('link', { name: 'Tomato Soup' }).closest('tr')?.textContent).toContain('Aantal ontbreekt');
  const date = screen.getByLabelText('Kies een datum');
  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(date, { target: { value: '2026-07-20' } });
  expect(screen.getByText('4 gerechten uitgesloten: geen prijs op deze datum')).toBeTruthy();
  expect(screen.queryByText(/no price on this date/)).toBeNull();
});
