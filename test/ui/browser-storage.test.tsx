import { act, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { coordinateStorage } from '@/ui/data/browserStorage';
import { demo, go, memoryStorage, renderApp, STORAGE_KEY } from './helpers';

function lockQueue() {
  let tail = Promise.resolve();
  return { request: vi.fn((_name: string, callback: () => Promise<void>) => {
    const next = tail.then(callback); tail = next.catch(() => {}); return next;
  }) };
}
class Channel {
  static channels = new Set<Channel>();
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(public name: string) { Channel.channels.add(this); }
  postMessage(data: unknown) {
    for (const other of Channel.channels) if (other !== this && other.name === this.name) {
      queueMicrotask(() => { if (Channel.channels.has(other)) other.onmessage?.({ data }); });
    }
  }
  close() { Channel.channels.delete(this); }
}
function tab(storage: ReturnType<typeof memoryStorage>, locks = lockQueue(), visible = true) {
  const doc = Object.assign(new EventTarget(), { visibilityState: visible ? 'visible' : 'hidden' });
  const win = Object.assign(new EventTarget(), { localStorage: storage });
  const env = { window: win, document: doc, locks, BroadcastChannel: Channel };
  // Injected browser surfaces still exercise the native-storage path, using memory only.
  const coordinator = coordinateStorage(storage, env as never);
  return { coordinator, doc, win, locks };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Channel.channels.clear(); });

it('takes the lock and hands it to another visible tab, then reacquires', async () => {
  const storage = memoryStorage(), locks = lockQueue();
  const a = tab(storage, locks), b = tab(storage, locks);
  const closeA = a.coordinator.start(); await a.coordinator.activate();
  a.coordinator.storage!.setItem(STORAGE_KEY, 'A');
  const closeB = b.coordinator.start(); await b.coordinator.activate();
  expect(() => a.coordinator.storage!.setItem(STORAGE_KEY, 'lost')).toThrow();
  b.coordinator.storage!.setItem(STORAGE_KEY, 'B');
  await a.coordinator.activate();
  expect(() => b.coordinator.storage!.setItem(STORAGE_KEY, 'lost')).toThrow();
  expect(storage.getItem(STORAGE_KEY)).toBe('B');
  closeA(); closeB();
});

it('a hidden tab never requests or takes write access, including pageshow and explicit activation', async () => {
  const storage = memoryStorage(), locks = lockQueue();
  const a = tab(storage, locks), b = tab(storage, locks, false);
  const closeA = a.coordinator.start(); await a.coordinator.activate();
  const requests = locks.request.mock.calls.length;
  const closeB = b.coordinator.start();
  b.win.dispatchEvent(new Event('pageshow'));
  b.doc.dispatchEvent(new Event('pointerdown'));
  await b.coordinator.activate().catch(() => {}); await tick();
  expect(locks.request).toHaveBeenCalledTimes(requests);
  expect(() => a.coordinator.storage!.setItem(STORAGE_KEY, 'still A')).not.toThrow();
  expect(() => b.coordinator.storage!.setItem(STORAGE_KEY, 'hidden')).toThrow();
  b.doc.visibilityState = 'visible'; b.doc.dispatchEvent(new Event('visibilitychange'));
  await b.coordinator.activate();
  b.coordinator.storage!.setItem(STORAGE_KEY, 'now B');
  closeA(); closeB();
});

it.each(['blur', 'pagehide'])('releases access on %s and reacquires on visible pageshow', async event => {
  const storage = memoryStorage(), a = tab(storage);
  const close = a.coordinator.start(); await a.coordinator.activate();
  a.win.dispatchEvent(new Event(event));
  expect(() => a.coordinator.storage!.setItem(STORAGE_KEY, 'denied')).toThrow();
  a.win.dispatchEvent(new Event('pageshow')); await a.coordinator.activate();
  a.coordinator.storage!.setItem(STORAGE_KEY, 'allowed'); close();
  expect(() => a.coordinator.storage!.setItem(STORAGE_KEY, 'closed')).toThrow();
});

it.each(['busy', 'unavailable'])('shows only the specific %s message and preserves form input', async mode => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(demo) });
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue(storage as never);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.stubGlobal('BroadcastChannel', Channel);
  const locks = lockQueue();
  let release: () => void = () => {};
  if (mode === 'busy') locks.request('menupilot:document-writer', () => new Promise<void>(resolve => { release = resolve; }));
  vi.stubGlobal('navigator', { language: 'en', locks: mode === 'busy' ? locks : undefined });
  const view = renderApp(storage); await go('#/ingredients');
  const row = screen.getByText('Beef mince 80/20', { selector: 'td' }).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /Rename/ }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Name'), ' draft');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
  expect(within(dialog).getByLabelText('Name')).toHaveProperty('value', 'Beef mince 80/20 draft');
  expect(screen.queryByText(/The change could not be saved/)).toBeNull();
  expect(within(dialog).getByText(mode === 'busy' ? /waiting for permission/ : /cannot safely coordinate/)).toBeTruthy();
  expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(demo));
  if (mode === 'busy') {
    release(); await act(tick);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activate editing in this tab' }));
    await waitFor(() => expect(screen.queryByText(/waiting for permission/)).toBeNull());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).ingredients[0].name).toBe('Beef mince 80/20 draft');
  }
  view.unmount(); release();
});
