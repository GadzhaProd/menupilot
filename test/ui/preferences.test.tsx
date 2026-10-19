import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage, renderApp, STORAGE_KEY } from './helpers';

const THEME = 'menupilot.ui.theme.v1';
const LOCALE = 'menupilot.ui.locale.v1';
function systemTheme(dark = false) {
  const listeners = new Set<() => void>();
  const media = { matches: dark, media: '(prefers-color-scheme: dark)', addEventListener: (_: string, f: () => void) => listeners.add(f), removeEventListener: (_: string, f: () => void) => listeners.delete(f), addListener: () => {}, removeListener: () => {} };
  vi.stubGlobal('matchMedia', (query: string) => query.includes('color-scheme') ? media : { ...media, matches: false });
  return { change(value: boolean) { act(() => { media.matches = value; listeners.forEach((f) => f()); }); }, listeners };
}
afterEach(() => vi.unstubAllGlobals());
describe('UI preferences', () => {
  it('follows system by default, reacts to OS, remembers manual choice and syncs tabs', async () => {
    const os = systemTheme(true); const storage = memoryStorage();
    const view = renderApp(storage);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect((screen.getByRole('combobox', { name: 'Theme' }) as HTMLSelectElement).value).toBe('system');
    os.change(false); expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
    expect(storage.getItem(THEME)).toBe('dark');
    os.change(true); os.change(false); expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent(window, new StorageEvent('storage', { key: THEME, newValue: 'light' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    view.unmount(); expect(os.listeners.size).toBe(0);
    renderApp(storage); expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('rejects invalid stored choices and keeps in-memory preference when writes fail', async () => {
    systemTheme(false); const storage = memoryStorage({ [THEME]: 'invalid' }); storage.failOnSet = new Error('blocked');
    renderApp(storage);
    expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByText(/cannot remember your theme/)).toBeTruthy();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('switches shell and html language, persists locale, never translates existing data', async () => {
    systemTheme(); const storage = memoryStorage(); renderApp(storage);
    await userEvent.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    expect(screen.getByRole('link', { name: 'Overzicht' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Thema' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('nl'); expect(storage.getItem(LOCALE)).toBe('nl');
    expect(screen.getAllByText('Classic Burger').length).toBeGreaterThan(0);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
  it('uses browser Dutch for the first demo, but saved preference wins', () => {
    systemTheme(); vi.spyOn(navigator, 'language', 'get').mockReturnValue('nl-BE');
    const first = renderApp(memoryStorage());
    expect(document.documentElement.lang).toBe('nl');
    expect(screen.getAllByText('Klassieke burger').length).toBeGreaterThan(0);
    first.unmount(); renderApp(memoryStorage({ [LOCALE]: 'en' }));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getAllByText('Classic Burger').length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});

it('reset loads the current language demo, while changing locale alone keeps data intact', async () => {
  systemTheme(); const storage = memoryStorage(); renderApp(storage);
  await userEvent.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
  await userEvent.click(screen.getByRole('link', { name: 'Gegevens' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terugzetten naar voorbeeldgegevens' }));
  const dialog = screen.getByRole('alertdialog');
  const confirm = [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Terugzetten naar voorbeeldgegevens')!;
  await userEvent.click(confirm);
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!).recipes[2].name).toBe('Klassieke burger');
  expect(storage.getItem('menupilot.ui.locale.v1')).toBe('nl');
});
it('a blocked preference read falls back and language works without saving', async () => {
  systemTheme(); const storage = memoryStorage();
  const get = storage.getItem;
  storage.getItem = (key) => { if (key.startsWith('menupilot.ui.')) throw new Error('blocked'); return get(key); };
  storage.failOnSet = new Error('blocked'); renderApp(storage);
  expect(document.documentElement.lang).toBe('en');
  await userEvent.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
  expect(document.documentElement.lang).toBe('nl');
  expect(screen.getByText(/taalkeuze niet bewaren/)).toBeTruthy();
});
it('locale storage events update the shell but do not change the loaded document', () => {
  systemTheme(); renderApp(memoryStorage());
  fireEvent(window, new StorageEvent('storage', { key: 'menupilot.ui.locale.v1', newValue: 'nl' }));
  expect(document.documentElement.lang).toBe('nl');
  expect(screen.getAllByText('Classic Burger').length).toBeGreaterThan(0);
});
