import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoCopy, go, memoryStorage, NOW, renderApp, storageWith } from './helpers';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); window.location.hash = ''; });
afterEach(() => vi.useRealTimers());

describe('C+ selected simulator', () => {
  it('keeps independent drafts, invalid text and locale-bound results when switching scenarios, language and theme', async () => {
    const user = userEvent.setup(); const storage = memoryStorage(); renderApp(storage);
    await go('#/simulator/dish_classic_burger');
    await user.click(screen.getByRole('button', { name: 'Add scenario' }));
    await user.type(screen.getByLabelText('Menu price (incl. VAT)'), '14.17');
    await user.click(screen.getByRole('button', { name: 'Add scenario' }));
    await user.type(within(screen.getByRole('region', { name: 'Scenario B' })).getByLabelText('Menu price (incl. VAT)'), '15x');
    await user.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    expect(screen.getByText(/Vul een bedrag van 0 of meer/)).toBeTruthy();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thema' }), 'dark');
    await user.click(screen.getByRole('radio', { name: 'Scenario A' }));
    const a = within(screen.getByRole('region', { name: 'Scenario A' }));
    expect(a.getByLabelText('Verkoopprijs (incl. btw)')).toHaveProperty('value', '14.17');
    expect(within(screen.getByRole('region', { name: 'Resultaat van scenario A' })).getByText('+€ 300,00')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Huidige situatie/ })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Scenario B' }));
    expect(within(screen.getByRole('region', { name: 'Scenario B' })).getByLabelText('Verkoopprijs (incl. btw)')).toHaveProperty('value', '15x');
    expect(storage.getItem('menupilot:v1')).toBeNull();
  }, 15000);

  it('distinguishes unknown cost from a valid zero sales estimate in Dutch', async () => {
    const doc = demoCopy(); doc.ingredients.find(i => i.id === 'ing_beef')!.prices = [];
    renderApp(storageWith(doc)); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    await go('#/simulator/dish_classic_burger');
    await user.click(screen.getByRole('button', { name: 'Scenario toevoegen' }));
    await user.type(screen.getByLabelText('Eigen verkoopaantal per maand (optioneel)'), '0');
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('kosten onbekend');
    expect(screen.getByTestId('highest-monthly').textContent).toContain('Niet genoeg gegevens');
    expect(screen.getByTestId('highest-monthly').textContent).toContain('kosten onbekend');
  });
});
