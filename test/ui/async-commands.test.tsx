import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { DataProvider, useCommands, useDocument } from '@/ui/data/DataProvider';
import { createBrowserStorageAdapter } from '@/store/browserAdapter.js';
import { StoreError } from '@/ui/domain/store';
import { demo, memoryStorage, NOW } from './helpers';
import type { MenuDocument } from '@/ui/domain/types';

function Probe() {
  const { execute, commandStatus } = useCommands();
  const doc = useDocument();
  return <><output>{commandStatus}</output><span data-testid="count">{doc.ingredients.length}</span>
    <button onClick={() => execute(async s => (await s.addIngredient({ name: 'Salt', unit: 'g' })))}>Save</button></>;
}
describe('asynchronous command publication', () => {
  it('waits for durability, rejects double execution and reports failure without replacing data in StrictMode', async () => {
    const adapter = createBrowserStorageAdapter(memoryStorage(), { initialDocument: demo as MenuDocument, now: () => NOW });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const original = adapter.save;
    let calls = 0;
    adapter.save = async (...args) => { calls++; await gate; return original(...args); };
    render(<StrictMode><DataProvider storage={null} adapter={adapter} demo={demo} now={() => NOW}><Probe /></DataProvider></StrictMode>);
    const button = await screen.findByText('Save');
    fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByText('saving')).toBeTruthy();
    expect(screen.getByTestId('count').textContent).toBe(String(demo.ingredients.length));
    expect(calls).toBe(1);
    await act(async () => { release(); });
    await screen.findByText('saved');
    expect(screen.getByTestId('count').textContent).toBe(String(demo.ingredients.length + 1));
    adapter.save = async () => { throw new StoreError('write-failed', 'offline'); };
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText('error')).toBeTruthy());
    expect(screen.getByTestId('count').textContent).toBe(String(demo.ingredients.length + 1));
  });
});

// Exercise actual forms against a delayed persistence boundary, not a mocked execute().
import userEvent from '@testing-library/user-event';
import { within } from '@testing-library/react';
import { App } from '@/ui/App';
import { go, savedDocument, STORAGE_KEY } from './helpers';

type Form = 'ingredient' | 'price' | 'recipe' | 'scenario' | 'data';
async function prepare(form: Form) {
  const u = userEvent.setup();
  if (form === 'ingredient') {
    await go('#/ingredients');
    await u.click(screen.getByRole('button', { name: 'Add ingredient' }));
    const region = within(screen.getByRole('dialog'));
    await u.type(region.getByLabelText('Name'), 'Salt draft');
    return { button: region.getByRole('button', { name: 'Add ingredient' }), draft: () => region.getByLabelText('Name'), value: 'Salt draft' };
  }
  if (form === 'price') {
    await go('#/ingredients');
    const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
    await u.click(within(row).getByRole('button', { name: /New price/ }));
    const region = within(screen.getByRole('dialog'));
    await u.type(region.getByLabelText(/Pack price/), '18.75');
    return { button: region.getByRole('button', { name: 'Save price' }), draft: () => region.getByLabelText(/Pack price/), value: '18.75' };
  }
  if (form === 'recipe') {
    await go('#/recipe/dish_classic_burger');
    await u.clear(screen.getByLabelText('Name')); await u.type(screen.getByLabelText('Name'), 'Burger draft');
    return { button: screen.getByRole('button', { name: 'Save changes' }), draft: () => screen.getByLabelText('Name'), value: 'Burger draft' };
  }
  if (form === 'scenario') {
    await go('#/simulator/dish_classic_burger');
    await u.click(screen.getByRole('button', { name: /Add scenario/ }));
    const region = within(screen.getByRole('region', { name: 'Scenario A' }));
    const name = region.getByLabelText('Scenario name');
    await u.clear(name); await u.type(name, 'Scenario draft');
    return { button: region.getByRole('button', { name: 'Save scenario' }), draft: () => region.getByLabelText('Scenario name'), value: 'Scenario draft' };
  }
  await go('#/data');
  const imported = structuredClone(demo); imported.ingredients[0]!.name = 'Imported draft';
  await u.upload(screen.getByLabelText('Backup file'), new File([JSON.stringify(imported)], 'draft-backup.json', { type: 'application/json' }));
  const region = within(await screen.findByRole('alertdialog'));
  return { button: region.getByRole('button', { name: 'Replace with backup' }), draft: () => region.getByText(/draft-backup.json/), value: null };
}

for (const form of ['ingredient', 'price', 'recipe', 'scenario', 'data'] as const) {
  for (const outcome of ['success', 'write-failed', 'conflict'] as const) {
    it(`${form}: delayed ${outcome}, duplicate click, draft and retry`, async () => {
      const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(demo) });
      const adapter = createBrowserStorageAdapter(storage, { initialDocument: demo as MenuDocument, now: () => NOW });
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const original = form === 'data' ? adapter.importDocument : adapter.save;
      let calls = 0;
      let error: 'write-failed' | 'conflict' | null = outcome === 'success' ? null : outcome;
      const delayed: typeof adapter.save & typeof adapter.importDocument = async (...args: any[]) => {
        calls++; await gate;
        if (error) throw new StoreError(error, 'The change could not be saved (offline). Your previous data is unchanged.');
        return (original as (...args: any[]) => ReturnType<typeof adapter.save>)(...args);
      };
      if (form === 'data') adapter.importDocument = delayed; else adapter.save = delayed;
      await act(async () => { render(<StrictMode><DataProvider storage={storage} adapter={adapter} demo={demo} now={() => NOW}><App /></DataProvider></StrictMode>); });
      const ready = await prepare(form);
      const before = storage.getItem(STORAGE_KEY);
      fireEvent.click(ready.button); fireEvent.click(ready.button);
      expect(calls).toBe(1);
      expect(ready.button).toHaveProperty('disabled', true);
      expect(ready.button.getAttribute('aria-busy')).toBe('true');
      expect(ready.button.textContent).toContain('Saving…');
      expect(storage.getItem(STORAGE_KEY)).toBe(before);
      if (ready.value !== null) {
        expect(ready.draft()).toHaveProperty('value', ready.value);
        expect(ready.draft().matches(':disabled')).toBe(true);
      }
      await userEvent.keyboard('{Escape}');
      if (form === 'ingredient' || form === 'price') expect(screen.getByRole('dialog')).toBeTruthy();
      if (form === 'data') expect(screen.getByRole('alertdialog')).toBeTruthy();
      await act(async () => { release(); });
      if (outcome !== 'success') {
        expect(storage.getItem(STORAGE_KEY)).toBe(before);
        if (ready.value !== null) expect(ready.draft()).toHaveProperty('value', ready.value);
        else expect(ready.draft()).toBeTruthy();
        if (outcome === 'conflict') expect(screen.getByText(/Another tab changed/)).toBeTruthy();
        else {
          expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
          expect(screen.getByText('The command was not completed.')).toBeTruthy();
        }
        expect(ready.button).toHaveProperty('disabled', false);
        error = null;
        await userEvent.click(ready.button);
      }
      await waitFor(() => expect(screen.getByText('Saved', { exact: true })).toBeTruthy());
      const saved = savedDocument(storage);
      if (form === 'ingredient') expect(saved.ingredients.filter(i => i.name === 'Salt draft')).toHaveLength(1);
      if (form === 'price') {
        expect(saved.ingredients[0]!.prices).toHaveLength(demo.ingredients[0]!.prices.length + 1);
        expect(saved.ingredients[0]!.prices.at(-1)!.packPriceCents).toBe(1875);
      }
      if (form === 'recipe') expect(saved.recipes.find(r => r.id === 'dish_classic_burger')!.name).toBe('Burger draft');
      if (form === 'scenario') expect(saved.scenarios).toHaveLength(1);
      if (form === 'data') expect(saved.ingredients[0]!.name).toBe('Imported draft');
      expect(calls).toBe(outcome === 'success' ? 1 : 2);
    });
  }
}
