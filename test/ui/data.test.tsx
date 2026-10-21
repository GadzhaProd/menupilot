import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useCommands, useDataState, useDocument } from '@/ui/data/DataProvider';
import { dataReducer } from '@/ui/data/reducer';
import type { MenuDocument } from '@/ui/domain/types';
import { STORAGE_KEY, demo, memoryStorage, renderApp } from './helpers';

/** Shows the beef price history length and exposes buttons for store commands. */
function Probe() {
  const document = useDocument();
  const { commandError } = useDataState();
  const { execute } = useCommands();
  const beef = document.ingredients.find((ingredient) => ingredient.id === 'ing_beef');
  return (
    <div>
      <p data-testid="beef-prices">{beef?.prices.length}</p>
      <p data-testid="error">{commandError ?? 'none'}</p>
      <button onClick={() => execute((store) => store.addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 }))}>
        add price
      </button>
      <button onClick={() => execute((store) => store.addPrice('ing_missing', { packPriceCents: 1, packSizeMilli: 1 }))}>
        add price to unknown ingredient
      </button>
    </div>
  );
}

const beefPrices = () => screen.getByTestId('beef-prices').textContent;
const initialBeefPrices = String(demo.ingredients.find((ingredient) => ingredient.id === 'ing_beef')?.prices.length);

describe('store ↔ React contract', () => {
  it('a successful command replaces the document on screen and saves it', async () => {
    const storage = memoryStorage();
    renderApp(storage, { children: <Probe /> });
    expect(beefPrices()).toBe(initialBeefPrices);
    expect(storage.data.has(STORAGE_KEY)).toBe(false); // the demo is not written until the first change

    await userEvent.click(screen.getByRole('button', { name: 'add price' }));

    expect(beefPrices()).toBe(String(Number(initialBeefPrices) + 1));
    const saved = JSON.parse(storage.data.get(STORAGE_KEY) ?? 'null') as MenuDocument;
    expect(saved.ingredients.find((ingredient) => ingredient.id === 'ing_beef')?.prices.at(-1)?.packPriceCents).toBe(1800);
  });

  it('a failed write keeps the previous document on screen and shows the error', async () => {
    const storage = memoryStorage();
    renderApp(storage, { children: <Probe /> });
    storage.failOnSet = new Error('disk is full');

    await userEvent.click(screen.getByRole('button', { name: 'add price' }));

    expect(beefPrices()).toBe(initialBeefPrices);
    expect(screen.getByTestId('error').textContent).toMatch(/could not be saved.*disk is full.*previous data is unchanged/i);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);

    // The next successful command clears the error.
    storage.failOnSet = null;
    await userEvent.click(screen.getByRole('button', { name: 'add price' }));
    expect(beefPrices()).toBe(String(Number(initialBeefPrices) + 1));
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('a rejected command (store validation) leaves the document unchanged', async () => {
    renderApp(memoryStorage(), { children: <Probe /> });
    await userEvent.click(screen.getByRole('button', { name: 'add price to unknown ingredient' }));
    expect(beefPrices()).toBe(initialBeefPrices);
    expect(screen.getByTestId('error').textContent).toMatch(/unknown ingredient/i);
  });

  it('data is still there after the provider is mounted again with the same storage', async () => {
    const storage = memoryStorage();
    const first = renderApp(storage, { children: <Probe /> });
    await userEvent.click(screen.getByRole('button', { name: 'add price' }));
    first.unmount();

    renderApp(storage, { children: <Probe /> });
    expect(beefPrices()).toBe(String(Number(initialBeefPrices) + 1));
  });

  it('runs a command once under StrictMode', async () => {
    const storage = memoryStorage();
    const writes = vi.spyOn(storage, 'setItem');
    renderApp(storage, { strict: true, children: <Probe /> });
    await userEvent.click(screen.getByRole('button', { name: 'add price' }));
    expect(writes.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(1);
    expect(beefPrices()).toBe(String(Number(initialBeefPrices) + 1));
  });

  it('corrupt saved data shows a clear error and is not overwritten', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
    renderApp(storage);
    expect(screen.getByRole('heading', { name: /could not be opened/i })).toBeTruthy();
    expect(screen.getAllByRole('alert')[0]?.textContent).toMatch(/not valid JSON/i);
    expect(storage.data.get(STORAGE_KEY)).toBe('{not json');
    expect(storage.setCalls).toBe(0);
  });

  it('blocked browser storage shows a clear error', () => {
    renderApp(null);
    expect(screen.getByRole('alert').textContent).toMatch(/storage is blocked/i);
  });
});

describe('dataReducer', () => {
  const document = demo as unknown as MenuDocument;
  const empty = { document: null, loadError: null, commandError: null };

  it('replaces the document and clears the command error', () => {
    const next = dataReducer({ ...empty, commandError: 'old' }, { type: 'documentReplaced', document });
    expect(next).toEqual({ document, loadError: null, commandError: null });
  });

  it('keeps the document when a command fails, and does not change its input', () => {
    const before = { ...empty, document };
    const next = dataReducer(before, { type: 'commandFailed', message: 'nope' });
    expect(next.document).toBe(document);
    expect(next.commandError).toBe('nope');
    expect(before.commandError).toBeNull();
  });

  it('dismisses the error', () => {
    expect(dataReducer({ ...empty, commandError: 'x' }, { type: 'errorDismissed' }).commandError).toBeNull();
  });
});
