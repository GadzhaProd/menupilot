import { afterEach, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, memoryStorage, STORAGE_KEY, demo } from './helpers';
import { LOCALE_KEY } from '@/ui/i18n/preferences';

const preferenceKey = 'menupilot.ui.local-version-notice-hidden.v1';
afterEach(() => { window.localStorage.clear(); document.querySelectorAll('#menupilot-local-config,meta[name="menupilot-mode"]').forEach((item) => item.remove()); window.location.hash = '#/'; });

it('shows a calm local-version note on browser Data and remembers dismissal outside the menu document', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(demo) });
  const app = await renderApp(storage);
  window.location.hash = '#/data';
  await screen.findByRole('heading', { name: 'Data' });
  expect(screen.getByText(/Want your data on your computer, with automatic backups\?/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Run locally (opens in a new tab)' }).getAttribute('href')).toBe('https://github.com/GadzhaProd/menupilot#run-locally');
  expect(screen.getByText(/macOS or Linux/)).toBeTruthy();
  expect(screen.getByText(/automatic backups \(about every 5 minutes\)/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Do not show' }));
  expect(screen.getByRole('heading', { name: 'Import backup' })).toBe(document.activeElement);
  expect(screen.queryByText(/Want your data on your computer, with automatic backups\?/)).toBeNull();
  expect(window.localStorage.getItem(preferenceKey)).toBe('true');
  expect(storage.data.get(STORAGE_KEY)).toBe(JSON.stringify(demo));
  app.unmount();
  await renderApp(storage);
  expect(screen.queryByText(/Want your data on your computer, with automatic backups\?/)).toBeNull();
});

it('uses Dutch text when the interface language is Dutch', async () => {
  const storage = memoryStorage({ [LOCALE_KEY]: 'nl', [STORAGE_KEY]: JSON.stringify(demo) });
  await renderApp(storage);
  window.location.hash = '#/data';
  await screen.findByRole('heading', { name: 'Gegevens' });
  expect(screen.getByText('Wil je je gegevens op je computer bewaren, met automatische kopieën?')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Niet meer tonen' })).toBeTruthy();
  expect(screen.getByText(/macOS of Linux/)).toBeTruthy();
  expect(screen.getByText(/automatische kopieën \(ongeveer elke 5 minuten\)/)).toBeTruthy();
});

it('does not show the browser-version note in local mode', async () => {
  const meta = document.createElement('meta'); meta.name = 'menupilot-mode'; meta.content = 'local'; document.head.append(meta);
  const script = document.createElement('script'); script.id = 'menupilot-local-config'; script.type = 'application/json';
  script.textContent = JSON.stringify({ mode: 'local', apiVersion: 1, token: 'a'.repeat(64), dataDir: '/tmp/MenuPilot' }); document.head.append(script);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/history') ? [] : { document: demo, schemaVersion: 2, revision: 1, documentId: 'local' }), { status: 200 })));
  window.location.hash = '#/data';
  await renderApp(memoryStorage());
  await screen.findByRole('heading', { name: 'Data' });
  expect(screen.queryByText(/Want your data on your computer, with automatic backups\?/)).toBeNull();
});
