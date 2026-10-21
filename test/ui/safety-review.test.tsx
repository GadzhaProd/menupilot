import { act, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createStore } from '@/ui/domain/store';
import { useDataSafety } from '@/ui/data/DataProvider';
import { useEffect } from 'react';
import { demo, demoCopy, go, memoryStorage, NOW, renderApp, savedDocument, storageWith, STORAGE_KEY } from './helpers';

beforeEach(() => { window.location.hash = ''; });
afterEach(() => vi.restoreAllMocks());
const signal = () => act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); });
function remote(storage: ReturnType<typeof memoryStorage>) { const s = createStore(storage, { demo, now: () => NOW }); s.load(); return s; }
async function renameBeef() {
  const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /Rename/ }));
  const dialog = screen.getByRole('dialog');
  await userEvent.clear(within(dialog).getByLabelText('Name'));
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Local draft');
  return dialog;
}

it('keeps a cached recipe draft through Help and refuses saving over an external change', async () => {
  const storage = storageWith(demoCopy());
  renderApp(storage); await go('#/recipe/dish_classic_burger');
  await userEvent.clear(screen.getByLabelText('Name'));
  await userEvent.type(screen.getByLabelText('Name'), 'My draft burger');
  await userEvent.click(screen.getByRole('link', { name: 'Help for this page' }));
  const other = remote(storage);
  other.addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 });
  const recipe = other.getDocument().recipes.find(r => r.id === 'dish_classic_burger')!;
  other.saveRecipe({ ...recipe, name: 'Remote burger' });
  const fresh = storage.getItem(STORAGE_KEY);
  signal();
  expect(await screen.findByText(/Another tab changed/)).toBeTruthy();
  await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'My draft burger');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(storage.getItem(STORAGE_KEY)).toBe(fresh);
  await userEvent.click(screen.getByRole('button', { name: 'Load latest data' }));
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'My draft burger');
  await go('#/help/dishes'); await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'My draft burger');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(savedDocument(storage).ingredients.find(i => i.id === 'ing_beef')?.prices.at(-1)?.packPriceCents).toBe(1800);
});

it('reloads when an unrelated item was deleted, preserving the edited ingredient', async () => {
  const doc = demoCopy(); doc.ingredients.push({ id: 'unused', name: 'Unused', unit: 'g', prices: [] });
  const storage = storageWith(doc); renderApp(storage); await go('#/ingredients');
  const dialog = await renameBeef();
  remote(storage).deleteIngredient('unused'); signal();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Load latest data' }));
  expect(within(dialog).getByLabelText('Name')).toHaveProperty('value', 'Local draft');
  expect(screen.queryByText(/removed an item/)).toBeNull();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  expect(savedDocument(storage).ingredients.find(i => i.id === 'ing_beef')?.name).toBe('Local draft');
});

it('refreshes the screen and clears the draft notice when a conflicting form is cancelled', async () => {
  const storage = memoryStorage(); renderApp(storage); await go('#/ingredients');
  const dialog = await renameBeef();
  remote(storage).updateIngredient('ing_beef', { name: 'Remote beef' }); signal();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText('Remote beef', { selector: 'td' })).toBeTruthy();
  expect(screen.queryByText(/Your draft is still here/)).toBeNull();
});

it('retains the memory copy after external storage clearing and can download it', async () => {
  const doc = demoCopy(); doc.ingredients[0]!.name = 'My saved beef';
  const storage = storageWith(doc); renderApp(storage); await go('#/ingredients');
  act(() => { storage.data.delete(STORAGE_KEY); }); signal();
  expect(screen.getByText('My saved beef', { selector: 'td' })).toBeTruthy();
  let blob: Blob | undefined;
  URL.createObjectURL = value => { blob = value as Blob; return 'blob:memory'; }; URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await userEvent.click(screen.getByRole('button', { name: 'Download the copy from this tab' }));
  expect(JSON.parse(await blob!.text())).toEqual(doc);
  expect(storage.getItem(STORAGE_KEY)).toBeNull();
});

it('Load latest opens recovery for damaged data and a valid backup can replace it', async () => {
  const storage = storageWith(demoCopy()); renderApp(storage); await go('#/ingredients');
  storage.setItem(STORAGE_KEY, '{remote corruption'); signal();
  await userEvent.click(screen.getByRole('button', { name: 'Load latest data' }));
  expect(await screen.findByRole('button', { name: 'Download damaged data' })).toBeTruthy();
  expect(storage.getItem(STORAGE_KEY)).toBe('{remote corruption');
  await userEvent.upload(screen.getByLabelText('Backup file'), new File([JSON.stringify(demo)], 'backup.json', { type: 'application/json' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Replace with backup' }));
  expect(await screen.findByRole('heading', { name: 'Ingredients', level: 1 })).toBeTruthy();
});

it('marks stale scenario snapshots and refreshes the page baseline after Load latest', async () => {
  const storage = memoryStorage(); renderApp(storage); await go('#/simulator/dish_classic_burger');
  await userEvent.click(screen.getByRole('button', { name: 'Add scenario' }));
  remote(storage).addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 }); signal();
  await userEvent.click(screen.getByRole('button', { name: 'Save scenario' }));
  expect(screen.queryByText(/Check that your browser has space/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Load latest data' }));
  const scenario = within(screen.getByRole('region', { name: 'Scenario A' }));
  expect(scenario.getByText('Baseline changed since this scenario was made')).toBeTruthy();
  expect(scenario.getByRole('button', { name: 'Update baseline' })).toBeTruthy();
  const row = screen.getByRole('row', { name: /Recipe-based ingredient cost/ });
  expect(within(row).getAllByRole('cell')[0]?.textContent).toContain('€5.03');
  await userEvent.click(scenario.getByRole('button', { name: 'Save scenario' }));
  expect(scenario.getByText('Baseline changed since this scenario was saved')).toBeTruthy();
});

it('registers multiple independent draft sources and removes only the unsubscribed source', async () => {
  const storage = memoryStorage();
  let stopFirst = () => {}, stopSecond = () => {};
  function Sources() {
    const { registerDraftSource } = useDataSafety();
    useEffect(() => {
      stopFirst = registerDraftSource(() => true); stopSecond = registerDraftSource(() => true);
      return () => { stopFirst(); stopSecond(); };
    }, [registerDraftSource]);
    return null;
  }
  const { App } = await import('@/ui/App');
  renderApp(storage, { children: <><Sources /><App /></> }); await go('#/ingredients');
  remote(storage).updateIngredient('ing_beef', { name: 'Remote beef' }); signal();
  expect(screen.getByText('Beef mince 80/20', { selector: 'td' })).toBeTruthy();
  act(stopFirst); signal();
  expect(screen.getByText('Beef mince 80/20', { selector: 'td' })).toBeTruthy();
  act(stopSecond); signal();
  await waitFor(() => expect(screen.getByText('Remote beef', { selector: 'td' })).toBeTruthy());
});

it('clears an obsolete conflict after cancelling when storage returned to the original bytes', async () => {
  const storage = storageWith(demoCopy()), original = storage.getItem(STORAGE_KEY)!;
  renderApp(storage); await go('#/ingredients');
  const dialog = await renameBeef();
  remote(storage).updateIngredient('ing_beef', { name: 'Remote beef' }); signal();
  storage.setItem(STORAGE_KEY, original); signal();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByText(/Your draft is still here/)).toBeNull());
});

it.each([false, true])('merges an untouched remote price into a renamed recipe (parked=%s)', async parked => {
  const storage = storageWith(demoCopy()); renderApp(storage); await go('#/recipe/dish_classic_burger');
  await userEvent.clear(screen.getByLabelText('Name')); await userEvent.type(screen.getByLabelText('Name'), 'Local name');
  if (parked) await go('#/help/dishes');
  const other = remote(storage), recipe = other.getDocument().recipes.find(r => r.id === 'dish_classic_burger')!;
  if (recipe.kind !== 'dish') throw new Error('Expected a dish');
  other.saveRecipe({ ...recipe, menuPriceInclVatCents: 2599 }); signal();
  await userEvent.click(screen.getByRole('button', { name: 'Load latest data' }));
  if (parked) await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Local name');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(savedDocument(storage).recipes.find(r => r.id === recipe.id)).toMatchObject({ name: 'Local name', menuPriceInclVatCents: 2599 });
});

it('requires a choice for the same changed field and keeps it through navigation', async () => {
  const storage = storageWith(demoCopy()); renderApp(storage); await go('#/recipe/dish_classic_burger');
  await userEvent.clear(screen.getByLabelText('Name')); await userEvent.type(screen.getByLabelText('Name'), 'Local name');
  const other = remote(storage), recipe = other.getDocument().recipes.find(r => r.id === 'dish_classic_burger')!;
  other.saveRecipe({ ...recipe, name: 'Remote name' }); signal();
  await userEvent.click(screen.getByRole('button', { name: 'Load latest data' }));
  await go('#/help/dishes'); await go('#/recipe/dish_classic_burger');
  expect(screen.getByRole('button', { name: 'Save changes' })).toHaveProperty('disabled', true);
  expect(screen.getByText(/Remote name/, { selector: 'pre' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Use latest value' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(savedDocument(storage).recipes.find(r => r.id === recipe.id)?.name).toBe('Remote name');
});
