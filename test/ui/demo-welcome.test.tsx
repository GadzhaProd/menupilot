import { afterEach, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoCopy, memoryStorage, renderApp, savedDocument, storageWith } from './helpers';

afterEach(() => { try { window.localStorage.removeItem('menupilot.demo-welcome.v1'); window.localStorage.removeItem('menupilot.demo-dismissed.v1'); } catch { /* Storage is optional in jsdom. */ } });

it('marks first-run bundled demo as fictional and lets the owner dismiss the notice', async () => {
  const user = userEvent.setup();
  await renderApp(memoryStorage());
  await screen.findByText('This is a fictional restaurant example.');
  await user.click(screen.getByRole('button', { name: 'Continue exploring the example' }));
  expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull();
});

it('hides the demo notice after the owner resets the example to empty data', async () => {
  const user = userEvent.setup();
  const storage = memoryStorage();
  await renderApp(storage);
  await screen.findByText('This is a fictional restaurant example.');
  await user.click(screen.getByRole('button', { name: 'Start with my own data' }));
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.click(within(dialog).getByRole('button', { name: 'Start with my own data' }));
  await waitFor(() => expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull());
  expect(savedDocument(storage).ingredients).toHaveLength(0);
});

it('does not mark saved owner data as demo', async () => {
  const document = demoCopy(); document.ingredients[0]!.name = 'My own tomatoes';
  await renderApp(storageWith(document));
  expect(await screen.findAllByText('What has changed on your menu?')).not.toHaveLength(0);
  expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull();
});
