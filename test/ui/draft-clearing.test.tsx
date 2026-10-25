import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { createStore } from '@/ui/domain/store';
import { demo, demoCopy, go, NOW, renderApp, storageWith, STORAGE_KEY } from './helpers';

beforeEach(() => { window.location.hash = ''; });
async function dirty() {
  await go('#/recipe/dish_classic_burger');
  await userEvent.clear(screen.getByLabelText('Name')); await userEvent.type(screen.getByLabelText('Name'), 'Obsolete cached name');
}
it('deleting a recipe clears its draft even when a new recipe reuses the id in the same app', async () => {
  const storage = storageWith(demoCopy()); (await renderApp(storage)); await dirty();
  await userEvent.click(screen.getByRole('button', { name: 'Delete dish' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete dish' }));
  await go('#/recipes');
  const other = createStore(storage, { demo, now: () => NOW }); (await other.load());
  (await other.saveRecipe({ id: 'dish_classic_burger', kind: 'dish', name: 'Reused id', menuPriceInclVatCents: 100, vatRateBp: 900, portions: 1, lines: [] }));
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); });
  // A missing clear would leave a registered cached draft and require manual reload.
  const reload = screen.queryByRole('button', { name: 'Load latest data' }); if (reload) await userEvent.click(reload);
  await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Reused id');
  expect(screen.queryByText('Obsolete cached name')).toBeNull();
});
it.each(['reset', 'import'])('%s clears cached drafts without unmounting the app', async mode => {
  const storage = storageWith(demoCopy()); (await renderApp(storage)); await dirty(); await go('#/data');
  if (mode === 'reset') {
    await userEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset to demo data' }));
  } else {
    await userEvent.upload(screen.getByLabelText('Backup file'), new File([JSON.stringify(demoCopy())], 'backup.json', { type: 'application/json' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace with backup' }));
  }
  await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Classic Burger');
  expect(screen.queryByText('Obsolete cached name')).toBeNull();
});

it('restoring history clears recipe and simulator caches without unmounting the app', async () => {
  const storage = storageWith(demoCopy());
  const store = createStore(storage, { demo, now: () => NOW }); (await store.load());
  (await store.updateIngredient('ing_beef', { name: 'Changed beef' }));
  (await renderApp(storage)); await dirty(); await go('#/simulator/dish_classic_burger');
  await userEvent.click(screen.getByRole('button', { name: 'Add scenario' }));
  expect(screen.getByRole('button', { name: 'Save scenario' })).toBeTruthy();
  await go('#/data');
  await userEvent.click(screen.getByRole('button', { name: 'Preview version' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Restore this version' }));
  await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Classic Burger');
  await go('#/simulator/dish_classic_burger');
  expect(screen.queryByRole('button', { name: 'Save scenario' })).toBeNull();
});

it('recovery replacement clears a parked recipe draft in the same mounted app', async () => {
  const storage = storageWith(demoCopy()); (await renderApp(storage)); await dirty(); await go('#/data');
  storage.setItem(STORAGE_KEY, '{bad');
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY })); });
  await userEvent.click(screen.getByRole('button', { name: 'Load latest data' }));
  await userEvent.upload(screen.getByLabelText('Backup file'), new File([JSON.stringify(demoCopy())], 'backup.json', { type: 'application/json' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace with backup' }));
  await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Classic Burger');
});
