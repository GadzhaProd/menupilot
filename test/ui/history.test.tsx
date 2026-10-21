import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createStore } from '@/ui/domain/store';
import { demo, demoCopy, go, NOW, renderApp, savedDocument, storageWith, STORAGE_KEY } from './helpers';

beforeEach(() => {
  window.location.hash = '';
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {};
});
afterEach(() => vi.restoreAllMocks());
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

it('Export updates its displayed date and resets the reminder through the page', async () => {
  const { storage } = prepared();
  storage.setItem('menupilot:backup', JSON.stringify({ startedAt: '2026-10-01T12:00:00.000Z', lastExportAt: '2026-10-10T12:00:00.000Z' }));
  renderApp(storage); await go('#/data');
  expect(screen.getByText(/It has been at least 7 days/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
  expect(screen.queryByText(/It has been at least 7 days/)).toBeNull();
  expect(screen.getByText(/Last Export requested: 18\/10\/2026/)).toBeTruthy();
  expect(JSON.parse(storage.getItem('menupilot:backup')!).lastExportAt).toBe(NOW);
});

it('defers the reminder across remounts without changing the last Export date', async () => {
  const { storage } = prepared();
  storage.setItem('menupilot:backup', JSON.stringify({ startedAt: '2026-10-01T12:00:00.000Z', lastExportAt: '2026-10-10T12:00:00.000Z' }));
  const app = renderApp(storage); await go('#/data');
  await userEvent.click(screen.getByRole('button', { name: 'Remind me later' }));
  expect(screen.queryByText(/It has been at least 7 days/)).toBeNull();
  app.unmount(); renderApp(storage);
  expect(screen.queryByText(/It has been at least 7 days/)).toBeNull();
  expect(screen.getByText(/Last Export requested: 10\/10\/2026/)).toBeTruthy();
});

it.each(['Export backup', 'Remind me later'])('reports a failed reminder metadata write from %s', async action => {
  const { storage } = prepared();
  storage.setItem('menupilot:backup', JSON.stringify({ startedAt: '2026-10-01T12:00:00.000Z', lastExportAt: null }));
  renderApp({ ...storage, setItem(k,v) { if (k === 'menupilot:backup') throw new Error('quota'); storage.setItem(k,v); } });
  await go('#/data');
  await userEvent.click(screen.getByRole('button', { name: action }));
  expect(screen.getByRole('alert').textContent).toMatch(/could not (record|postpone)/);
  expect(screen.getByText(/It has been at least 7 days/)).toBeTruthy();
  expect(JSON.parse(storage.getItem('menupilot:backup')!).lastExportAt).toBeNull();
});

it('explains future-dated prices when a version cannot be restored', async () => {
  const { storage } = prepared();
  const key = [...storage.data.keys()].find(k => k.startsWith('menupilot:history:'))!;
  const entry = JSON.parse(storage.getItem(key)!);
  const snapshot = JSON.parse(entry.raw); snapshot.ingredients[0].prices.at(-1).recordedAt = '2030-01-01T12:00:00.000Z';
  storage.setItem(key, JSON.stringify({ ...entry, raw: JSON.stringify(snapshot) }));
  const before = storage.getItem(STORAGE_KEY);
  renderApp(storage); await go('#/data');
  await userEvent.click(screen.getByRole('button', { name: 'Preview version' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Restore version' }));
  expect(screen.getByRole('alert').textContent).toMatch(/prices dated in the future/);
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
});
