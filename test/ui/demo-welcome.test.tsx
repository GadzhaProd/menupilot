import { afterEach, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { demoCopy, memoryStorage, renderApp, savedDocument, storageWith } from './helpers';

afterEach(() => { try { for (let i = window.localStorage.length - 1; i >= 0; i--) { const key = window.localStorage.key(i); if (key?.startsWith('menupilot.demo-welcome.') || key?.startsWith('menupilot.demo-dismissed.')) window.localStorage.removeItem(key); } } catch { /* Storage is optional in jsdom. */ } });

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

it('remembers Continue exploring after a full app reload for the same document identity', async () => {
  const user = userEvent.setup();
  const storage = memoryStorage();
  await renderApp(storage);
  await screen.findByText('This is a fictional restaurant example.');
  await user.click(screen.getByRole('button', { name: 'Continue exploring the example' }));
  cleanup();
  await renderApp(storage);
  await screen.findByRole('heading', { level: 1, name: 'What has changed on your menu?' });
  expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull();
});

it('shows the notice for a saved local demo document but not an empty local database', async () => {
  const empty = demoCopy(); empty.ingredients = []; empty.recipes = []; empty.scenarios = [];
  await renderApp(storageWith(empty));
  await screen.findByRole('heading', { level: 1, name: 'What has changed on your menu?' });
  expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull();
  cleanup();
  await renderApp(storageWith(demoCopy()));
  expect(await screen.findByText('This is a fictional restaurant example.')).toBeTruthy();
});

it('hides the notice after the first own save for that document identity', async () => {
  const user = userEvent.setup();
  await renderApp(memoryStorage());
  await screen.findByText('This is a fictional restaurant example.');
  await user.click(screen.getByRole('link', { name: 'Recipes' }));
  await user.click(await screen.findByRole('link', { name: 'New dish' }));
  await user.type(await screen.findByLabelText('Name'), 'My own dish');
  await user.type(screen.getByLabelText('Menu price (incl. VAT)'), '10.00');
  await user.selectOptions(screen.getByLabelText('Ingredient or prep'), 'ingredient:ing_beef');
  await user.type(screen.getByLabelText(/Net quantity/), '0.1');
  await user.click(screen.getByRole('button', { name: 'Save dish' }));
  await screen.findByRole('heading', { level: 1, name: 'My own dish' });
  expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull();
});

it('does not mark saved owner data as demo', async () => {
  const document = demoCopy(); document.ingredients[0]!.name = 'My own tomatoes';
  await renderApp(storageWith(document));
  expect(await screen.findAllByText('What has changed on your menu?')).not.toHaveLength(0);
  expect(screen.queryByText('This is a fictional restaurant example.')).toBeNull();
});
