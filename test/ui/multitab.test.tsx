import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { createStore } from '@/ui/domain/store';
import { demo, go, memoryStorage, NOW, renderApp, savedDocument, STORAGE_KEY } from './helpers';

beforeEach(() => { window.location.hash = ''; });
async function otherTab(storage: ReturnType<typeof memoryStorage>) {
  const store = createStore(storage, { demo, now: () => NOW });
  (await store.load());
  return store;
}
function signal() { act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); }); }

it('refreshes an idle tab after a storage event', async () => {
  const storage = memoryStorage();
  (await renderApp(storage)); await go('#/ingredients');
  (await (await otherTab(storage)).updateIngredient('ing_beef', { name: 'Fresh beef' }));
  signal();
  expect(await screen.findByText('Fresh beef', { selector: 'td' })).toBeTruthy();
});

it('keeps a rename draft on conflict and reloads fresh data without closing the dialog', async () => {
  const storage = memoryStorage();
  (await renderApp(storage)); await go('#/ingredients');
  const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /rename/i }));
  const dialog = screen.getByRole('dialog');
  const name = within(dialog).getByLabelText('Name');
  await userEvent.clear(name); await userEvent.type(name, 'My beef');
  (await (await otherTab(storage)).addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 }));
  const newer = storage.getItem(STORAGE_KEY);
  signal();
  expect((name as HTMLInputElement).value).toBe('My beef');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  expect(storage.getItem(STORAGE_KEY)).toBe(newer);
  expect((name as HTMLInputElement).value).toBe('My beef');
  expect(within(dialog).getByText(/Another tab changed/)).toBeTruthy();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Load latest data' }));
  expect(screen.getByRole('dialog')).toBe(dialog);
  expect((name as HTMLInputElement).value).toBe('My beef');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  const beef = savedDocument(storage).ingredients.find(i => i.id === 'ing_beef');
  expect(beef?.name).toBe('My beef');
  expect(beef?.prices.at(-1)?.packPriceCents).toBe(1800);
});

it('a successful write is published even if subsequent storage reads fail', async () => {
  const backing = memoryStorage();
  let readsBlocked = false;
  const storage = {
    isolated: true,
    getItem(key: string) { if (readsBlocked) throw new Error('reading is blocked'); return backing.getItem(key); },
    setItem(key: string, value: string) { backing.setItem(key, value); if (key === STORAGE_KEY) readsBlocked = true; },
  };
  (await renderApp(storage)); await go('#/ingredients');
  const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /rename/i }));
  const dialog = screen.getByRole('dialog');
  const input = within(dialog).getByLabelText('Name');
  await userEvent.clear(input); await userEvent.type(input, 'Saved beef');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Saved beef', { selector: 'td' })).toBeTruthy();
});

it('does not unmount a draft when latest data removed its ingredient', async () => {
  const storage = memoryStorage();
  (await renderApp(storage)); await go('#/ingredients');
  const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /rename/i }));
  const dialog = screen.getByRole('dialog');
  const name = within(dialog).getByLabelText('Name');
  await userEvent.clear(name); await userEvent.type(name, 'Keep this draft');
  (await (await otherTab(storage)).resetToEmpty());
  signal();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Load latest data' }));
  expect((name as HTMLInputElement).isConnected).toBe(true);
  expect((name as HTMLInputElement).value).toBe('Keep this draft');
  expect(within(dialog).getByText(/removed an item/)).toBeTruthy();
  // No implicit rebase: saving the old document is still rejected.
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  expect(savedDocument(storage).ingredients).toEqual([]);
});
