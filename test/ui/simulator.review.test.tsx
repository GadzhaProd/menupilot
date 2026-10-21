import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { go, renderApp } from './helpers';

it('does not rank different volumes, including a scenario with 1000 sales against 300 baseline sales', async () => {
  const user = userEvent.setup(); (await renderApp());
  await go('#/simulator/dish_classic_burger');
  await user.click(screen.getByRole('button', { name: 'Add scenario' }));
  const volume = screen.getByLabelText('Own sales per month (optional)');
  await user.type(volume, '1000');
  expect(screen.getByTestId('highest-monthly').textContent).toContain('Volumes differ — not compared');
  expect(screen.queryByText('highest monthly')).toBeNull();
  expect(screen.getByRole('table').textContent).toContain('1,000');
  expect(screen.getByText('At 1,000 sales per month · your estimate, not a forecast')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
  expect(screen.getByTestId('highest-monthly').textContent).toContain('Aantallen verschillen — niet vergeleken');
  expect(screen.getByRole('table').textContent).toContain('1.000');
  await user.clear(volume); await user.type(volume, '1');
  expect(screen.getByText('Bij 1 verkoop per maand · jouw schatting, geen voorspelling')).toBeTruthy();
  expect(screen.getByText('Berekend met 1 verkoop per maand (opgeslagen bij dit scenario).')).toBeTruthy();
  await user.clear(volume); await user.type(volume, '300');
  expect(screen.getByTestId('highest-monthly').textContent).not.toContain('niet vergeleken');
  expect(screen.getByTestId('highest-monthly').textContent).toContain('Huidige situatie');
});

it('keeps the shared estimate field labelled without repeating its visible heading', async () => {
  (await renderApp()); await go('#/simulator/dish_classic_burger');
  const input = screen.getByLabelText('Expected sales per month (your estimate)');
  expect(input.closest('details')?.querySelector('summary')?.textContent).toBe('Expected sales per month (your estimate)');
  expect(input.closest('details')?.querySelector('label')?.parentElement?.className).toContain('sr-only');
  expect(within(screen.getByRole('main')).getByRole('button', { name: 'Add scenario' })).toBeTruthy();
});

it('ranks ties only at equal volumes and ignores unknown monthly figures', async () => {
  const { highestMonthly, monthlyVolumesDiffer } = await import('@/ui/domain/simulator');
  const baseline = { key: 'baseline', monthlyCents: 100n, monthlyVolume: 300 };
  expect(highestMonthly([baseline, { key: 'A', monthlyCents: 100n, monthlyVolume: 300 }])?.keys).toEqual(['baseline', 'A']);
  expect(highestMonthly([baseline, { key: 'A', monthlyCents: 1000n, monthlyVolume: 1000 }])).toBeNull();
  expect(monthlyVolumesDiffer([baseline, { key: 'unknown', monthlyCents: null, monthlyVolume: 1000 }])).toBe(false);
  expect(highestMonthly([baseline])).toBeNull();
});

it('uses whole-message singular and plural forms for sales estimates in both languages', async () => {
  const { plural } = await import('@/ui/i18n');
  for (const key of ['simulator.resultHint', 'simulator.calculatedShared', 'simulator.calculatedOwn', 'simulator.sold'] as const) {
    expect(plural('en', key, 1)).not.toContain('1 sales');
    expect(plural('nl', key, 1)).not.toContain('1 verkopen');
    expect(plural('en', key, 1000, { count: '1,000' })).toContain('1,000');
    expect(plural('nl', key, 1000, { count: '1.000' })).toContain('1.000');
  }
});
