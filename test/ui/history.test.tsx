import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { createStore } from '@/ui/domain/store';
import { demo, demoCopy, go, NOW, renderApp, savedDocument, storageWith, STORAGE_KEY } from './helpers';

beforeEach(() => { window.location.hash = ''; });
function prepared() {
  const storage = storageWith(demoCopy());
  const store = createStore(storage, { demo, now: () => NOW }); store.load();
  store.updateIngredient('ing_beef', { name: 'Updated beef' });
  return { storage, store };
}
it('previews differences and restores a version with confirmation, archiving current data', async () => {
  const { storage, store } = prepared(); renderApp(storage); await go('#/data');
  await userEvent.click(screen.getByRole('button', { name: 'Preview version' }));
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByText(/Changed entries: 1 ingredients/)).toBeTruthy();
  expect(savedDocument(storage).ingredients[0]!.name).toBe('Updated beef');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Restore version' }));
  expect(savedDocument(storage).ingredients[0]!.name).toBe('Beef mince 80/20');
  expect(store.listHistory()).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Preview version' })).toHaveLength(2);
});
it('offers validated history even when the main document is damaged', async () => {
  const { storage } = prepared(); storage.setItem(STORAGE_KEY, '{bad'); renderApp(storage);
  await userEvent.click(screen.getByRole('button', { name: 'Preview version' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Restore version' }));
  expect(savedDocument(storage).ingredients[0]!.name).toBe('Beef mince 80/20');
});

it('shows a visible warning when an ordinary save succeeds without history', async () => {
  const { storage } = prepared();
  const constrained = { ...storage, setItem(key: string, value: string) {
    if (key.startsWith('menupilot:history:')) throw new Error('quota unavailable');
    storage.setItem(key, value);
  } };
  renderApp(constrained); await go('#/recipe/dish_classic_burger');
  await userEvent.clear(screen.getByLabelText('Name')); await userEvent.type(screen.getByLabelText('Name'), 'Still saved');
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(screen.getByText(/Version history is unavailable/)).toBeTruthy();
  expect(savedDocument(storage).recipes.find(r => r.id === 'dish_classic_burger')?.name).toBe('Still saved');
});

it('shows a seven-day reminder and the recorded last Export date', async () => {
  const { storage } = prepared();
  storage.setItem('menupilot:backup', JSON.stringify({ startedAt: '2026-10-01T12:00:00.000Z', lastExportAt: '2026-10-10T12:00:00.000Z' }));
  renderApp(storage); await go('#/data');
  expect(screen.getByText(/It has been at least 7 days/)).toBeTruthy();
  expect(screen.getByText(/Last Export requested: 10\/10\/2026/)).toBeTruthy();
});
