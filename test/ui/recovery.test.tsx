import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { demo, go, memoryStorage, renderApp, STORAGE_KEY } from './helpers';
const raw = '{bad\n  original bytes';
const file = (text: string) => new File([text], 'backup.json', { type: 'application/json' });
beforeEach(() => { window.location.hash = ''; });
afterEach(() => vi.restoreAllMocks());

it('downloads the exact damaged text and never changes storage', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  let blob: Blob | undefined;
  URL.createObjectURL = value => { blob = value as Blob; return 'blob:raw'; };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  renderApp(storage);
  await userEvent.click(screen.getByRole('button', { name: 'Download damaged data' }));
  expect(await blob?.text()).toBe(raw);
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
});

it('restores a validated backup only after confirmation; cancel preserves raw data', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  renderApp(storage); await go('#/data');
  await userEvent.upload(screen.getByLabelText('Backup file'), file(JSON.stringify(demo)));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  await userEvent.upload(screen.getByLabelText('Backup file'), file(JSON.stringify(demo)));
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace with backup' }));
  await screen.findByRole('heading', { name: 'Data', level: 1 });
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!).ingredients).toEqual(demo.ingredients);
});

it('refuses an invalid backup without replacing damaged storage', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  renderApp(storage);
  await userEvent.upload(screen.getByLabelText('Backup file'), file('{bad backup'));
  await waitFor(() => expect(screen.getByText(/This backup is not valid/)).toBeTruthy());
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
});

it('offers download and confirms empty reset in Dutch, including cancel', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 999 }) });
  renderApp(storage);
  await userEvent.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
  expect(screen.getByRole('button', { name: 'Beschadigde gegevens downloaden' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Beginnen met lege gegevens' }));
  let dialog = within(screen.getByRole('alertdialog'));
  expect(dialog.getByText(/Download eerst/)).toBeTruthy();
  await userEvent.click(dialog.getByRole('button', { name: 'Annuleren' }));
  expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ version: 999 }));
  await userEvent.click(screen.getByRole('button', { name: 'Beginnen met lege gegevens' }));
  dialog = within(screen.getByRole('alertdialog'));
  await userEvent.click(dialog.getByRole('button', { name: 'Bevestigen en vervangen' }));
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!).ingredients).toEqual([]);
});
