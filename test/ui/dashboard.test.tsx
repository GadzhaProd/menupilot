import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderApp, storageWith, demoCopy } from './helpers';

beforeEach(() => {
  window.location.hash = '';
});
afterEach(() => { vi.useRealTimers(); });

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
    (await renderApp());

    await user.click(screen.getByRole('button', { name: '7 days' }));
    expect(dishCells('Classic Burger').slice(1, 4)).toEqual([
      '€4.85', '€4.85', '€0.000.0 pp',
    ]);
    expect(dishCells('Classic Burger')[5]).toBe('€0.00');

    await user.click(screen.getByRole('button', { name: '30 days' }));
    expect(dishCells('Classic Burger').slice(1, 3)).toEqual(['€4.20', '€4.85']);
    expect(dishCells('Classic Burger')[5]).toBe('-€195.00');

    await user.click(screen.getByRole('button', { name: '90 days' }));
    expect(screen.getByRole('button', { name: '90 days' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(dishCells('Classic Burger').slice(1, 4)).toEqual([
      'no price on this date', '€4.85', 'no price on this dateno price on this date',
    ]);
    expect(screen.getByText(/4 dishes excluded/)).toBeTruthy();
    // Nothing to compare with: explained, not shown as a bare €0.00 "incomplete".
    expect(screen.getByText(/This is not “no change”/)).toBeTruthy();

    const datePicker = screen.getByLabelText('Choose date');
    fireEvent.change(datePicker, { target: { value: '2026-10-11' } });
    expect(dishCells('Classic Burger').slice(1, 3)).toEqual(['€4.85', '€4.85']);
  });

  it('shows recipe and simulator links for a dish', async () => {
    (await renderApp());
    const table = dishTable();
    const burgerRow = within(table).getByRole('row', { name: /Classic Burger/ });

    expect(within(burgerRow).getByRole('link', { name: 'Classic Burger' })
      .getAttribute('href')).toBe('#/recipe/dish_classic_burger');
    expect(within(burgerRow).getByRole('link', { name: 'Simulate' })
      .getAttribute('href')).toBe('#/simulator/dish_classic_burger');
  });

  it('renders the same cost and impact values in the mobile dish cards', async () => {
    const user = userEvent.setup();
    (await renderApp());
    await user.click(screen.getByRole('button', { name: '30 days' }));

    const burgerCards = screen.getAllByRole('article').filter((article) =>
      within(article).queryByRole('link', { name: 'Classic Burger' }),
    );
    expect(burgerCards).toHaveLength(1);
    expect(within(burgerCards[0]!).getByText('€4.20')).toBeTruthy();
    expect(within(burgerCards[0]!).getByText('€4.85')).toBeTruthy();
    expect(within(burgerCards[0]!).getByText('-€195.00')).toBeTruthy();
  });

  it('ignores dates after today and exposes today as the maximum date', async () => {
    // "Today" must not depend on the real clock: the demo is written for NOW.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    (await renderApp());
    const datePicker = screen.getByLabelText('Choose date');
    expect(datePicker.getAttribute('max')).toBe('2026-10-18');
    fireEvent.change(datePicker, { target: { value: '2026-10-19' } });
    expect(dishCells('Classic Burger').slice(1, 3)).toEqual(['€4.20', '€4.85']);
    fireEvent.change(datePicker, { target: { value: '275760-09-13' } });
    expect(screen.getByRole('heading', { name: 'What has changed on your menu?' })).toBeTruthy();
    expect(dishCells('Classic Burger').slice(1, 3)).toEqual(['€4.20', '€4.85']);
  });

  it('uses the injected clock for both the default comparison date and date maximum', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T12:00:00.000Z'));
    await renderApp(undefined, { now: () => new Date('2027-01-31T12:00:00.000Z') });
    const datePicker = screen.getByLabelText('Choose date') as HTMLInputElement;
    expect(datePicker.value).toBe('2027-01-01');
    expect(datePicker.max).toBe('2027-01-31');
  });
});


it('names missing comparison prices in both dish layouts, capped at three, with EN/NL guidance', async () => {
  const doc = demoCopy();
  for (const item of doc.ingredients) for (const price of item.prices) price.recordedAt = NOW;
  await renderApp(storageWith(doc));
  const row = dishRow('Classic Burger');
  const note = within(row).getByText(/Missing prices on this date:/).closest('p')!;
  expect(note.textContent).toMatch(/Beef mince 80\/20/);
  expect(note.textContent).toContain('Brioche burger bun');
  expect(note.textContent).toContain('Aged cheddar');
  expect(note.textContent).toMatch(/and \d+ more/);
  expect(note.textContent).not.toContain('Mayonnaise');
  expect(within(note).getByRole('link', { name: 'Ingredients' }).getAttribute('href')).toBe('#/ingredients');
  const card = screen.getAllByRole('article').find(a => within(a).queryByRole('link', { name: 'Classic Burger' }))!;
  expect(within(card).getByText(/Missing prices on this date:/).textContent).toBe(note.textContent);
  expect(screen.getByText(/A comparison needs a price on this date for every ingredient/).textContent).toContain('including its preps');
  await userEvent.setup().click(screen.getByRole('button', { name: 'NL – Nederlands' }));
  expect(screen.getAllByText(/Ontbrekende prijzen op deze datum:/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Voor een vergelijking heeft elk ingrediënt/).textContent).toContain('basisrecepten');
});
