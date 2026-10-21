import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { browserLocks } from '@/ui/data/browserStorage';
import { demo, go, memoryStorage, renderApp, STORAGE_KEY, savedDocument } from './helpers';

function lockQueue() {
  let tail = Promise.resolve();
  return { request: vi.fn((_name: string, callback: () => Promise<void>) => {
    const next = tail.then(callback); tail = next.catch(() => {}); return next;
  }) };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('uses Web Locks only for native storage', () => {
  expect(browserLocks(memoryStorage())).toBeUndefined();
  const storage = memoryStorage();
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as never);
  vi.stubGlobal('navigator', { language: 'en' });
  expect(browserLocks(storage)).toBeNull();
});
it.each(['busy', 'unavailable'])('keeps the draft while the writer is %s', async mode => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(demo) });
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as never);
  const locks = lockQueue();
  let release: () => void = () => {};
  if (mode === 'busy') void locks.request('menupilot:document-writer', () => new Promise<void>(resolve => { release = resolve; }));
  vi.stubGlobal('navigator', { language: 'en', locks: mode === 'busy' ? locks : undefined });
  await renderApp(storage); await go('#/ingredients');
  const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /Rename/ }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Name'), ' draft');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  expect(within(dialog).getByLabelText('Name')).toHaveProperty('value', 'Beef mince 80/20 draft');
  expect(screen.queryByText(/The change could not be saved/)).toBeNull();
  expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(demo));
  if (mode === 'busy') {
    expect(within(dialog).getByRole('button', { name: 'Saving…' })).toHaveProperty('disabled', true);
    await act(async () => { release(); });
    expect(savedDocument(storage).ingredients[0]!.name).toBe('Beef mince 80/20 draft');
    expect(screen.queryByRole('dialog')).toBeNull();
  } else expect(within(dialog).getByText(/cannot safely coordinate/)).toBeTruthy();
});
