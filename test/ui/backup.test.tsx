import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuDocument } from '@/ui/domain/types';
import { backupFileName } from '@/ui/pages/DataPage';
import {
  demoCopy, go, memoryStorage, NOW, renderApp, sauceDoc, savedDocument, storageWith,
} from './helpers';

const downloads: { text: string; name: string }[] = [];

beforeEach(() => {
  window.location.hash = '';
  downloads.length = 0;
  // jsdom has no object URLs: capture what the page would download.
  const blobs = new Map<string, Blob>();
  let counter = 0;
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    const url = `blob:test-${counter += 1}`;
    blobs.set(url, blob as Blob);
    return url;
  };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    if (!blob) return;
    void blob.text().then((text) => downloads.push({ text, name: this.download }));
  });
});
afterEach(() => { vi.restoreAllMocks(); });

async function openData(storage = memoryStorage()) {
  (await renderApp(storage));
  await go('#/data');
  await screen.findByRole('heading', { level: 1, name: 'Data' });
  return storage;
}

const jsonFile = (text: string, name = 'backup.json') => new File([text], name, { type: 'application/json' });

async function chooseFile(file: File) {
  await userEvent.upload(screen.getByLabelText('Backup file'), file);
}

const dialog = () => screen.findByRole('alertdialog');

/** Beef is in the demo; a distinctive ingredient name proves which data is on screen. */
function ingredientNames(doc: { ingredients: { name: string }[] }) {
  return doc.ingredients.map((ingredient) => ingredient.name);
}

describe('Data page', () => {
  it('localizes singular counts and includes the first NL validation detail for an invalid import', async () => {
    const doc = demoCopy();
    doc.ingredients = doc.ingredients.slice(0, 1);
    doc.recipes = [];
    doc.scenarios = [];
    const storage = await openData(storageWith(doc));
    expect(screen.getByText('Now: 1 ingredient, 0 recipes, 0 saved scenarios.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'NL – Nederlands' }));
    expect(screen.getByText('Nu: 1 ingrediënt, 0 recepten, 0 opgeslagen scenario’s.')).toBeTruthy();
    await userEvent.upload(screen.getByLabelText('Reservekopiebestand'), jsonFile(JSON.stringify({ version: 1 })));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Vervangen door reservekopie' }));

    const alert = await within(await dialog()).findByRole('alert');
    expect(alert.textContent).toContain('Deze gegevens passen niet bij het MenuPilot-formaat');
    expect(alert.textContent).toContain('settings');
    expect(savedDocument(storage).ingredients).toHaveLength(1);
  });

  it('is reachable from the main navigation and explains where data lives', async () => {
    (await renderApp());
    await userEvent.click(screen.getByRole('link', { name: 'Data' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Data' })).toBeTruthy();
    expect(screen.getByText('Your data lives only in this browser. Export a backup regularly.')).toBeTruthy();
  });

  it('names the file with the date', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('menupilot-backup-2026-10-05.json');
  });

  it('export downloads valid JSON of the whole document', async () => {
    await openData();
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    const [file] = downloads;
    expect(file?.name).toMatch(/^menupilot-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(file?.text ?? '').document as MenuDocument;
    expect(parsed.ingredients.length).toBe(demoCopy().ingredients.length);
    expect(parsed.recipes.length).toBe(demoCopy().recipes.length);
    expect(screen.getAllByRole('status').map(node => node.textContent).join(' ')).toMatch(/Backup saved as menupilot-backup-/);
  });

  it('importing a valid file replaces the data after confirmation', async () => {
    const storage = await openData();
    const text = JSON.stringify(sauceDoc());
    await chooseFile(jsonFile(text));

    const confirmation = within(await dialog());
    expect(confirmation.getByText(/This replaces all current data/)).toBeTruthy();
    expect(storage.setCalls).toBe(0); // nothing changes before the owner confirms
    await userEvent.click(confirmation.getByRole('button', { name: 'Replace with backup' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(ingredientNames(savedDocument(storage))).toEqual(['Tomatoes', 'Spice mix', 'Saffron']);
    expect(screen.getAllByRole('status').map(node => node.textContent).join(' ')).toMatch(/backup\.json was imported/);
    expect(screen.getByText(/Now: 3 ingredients, 0 recipes/)).toBeTruthy();
  });

  it('a broken file is rejected with a clear message and the data stays', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    const before = storage.data.get('menupilot:v1');
    await chooseFile(jsonFile('{not json'));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Replace with backup' }));

    const alert = await within(await dialog()).findByRole('alert');
    expect(alert.textContent).toMatch(/not valid JSON.*current data was not changed/i);
    expect(storage.data.get('menupilot:v1')).toBe(before);
    expect(storage.setCalls).toBe(0);
    expect(screen.getByText(/Now: 3 ingredients/)).toBeTruthy();
  });

  it('a wrong data version is rejected with the versions named', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    await chooseFile(jsonFile(JSON.stringify({ ...sauceDoc(), version: 99 })));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Replace with backup' }));
    expect((await within(await dialog()).findByRole('alert')).textContent).toMatch(/version 99.*supports version/);
    expect(storage.setCalls).toBe(0);
  });

  it('a recipe cycle is rejected and the data stays', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    const cyclic = demoCopy();
    const prep = cyclic.recipes.find((recipe) => recipe.kind === 'prep');
    if (!prep) throw new Error('demo has a prep');
    prep.lines.push({ ref: { kind: 'prep', id: prep.id }, netQtyMilli: 1000, yieldBp: 10_000 } as never);
    await chooseFile(jsonFile(JSON.stringify(cyclic)));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Replace with backup' }));
    expect((await within(await dialog()).findByRole('alert')).textContent).toMatch(/not valid|cycle|itself/i);
    expect(storage.setCalls).toBe(0);
  });

  it('a file that is too large is refused before it is read', async () => {
    const storage = await openData();
    await chooseFile(new File([new Uint8Array(5_000_001)], 'huge.json', { type: 'application/json' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/huge\.json is too large.*not changed/i);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(storage.setCalls).toBe(0);
  });

  it('cancel in the import dialog changes nothing', async () => {
    const storage = await openData();
    await chooseFile(jsonFile(JSON.stringify(sauceDoc())));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(storage.setCalls).toBe(0);
    expect(screen.getByText(new RegExp(`Now: ${demoCopy().ingredients.length} ingredients`))).toBeTruthy();
  });

  it('reset to demo asks first, then restores the demo data', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    expect(screen.getByText(/Now: 3 ingredients, 0 recipes/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }));
    expect(storage.setCalls).toBe(0);
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Reset to demo data' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(ingredientNames(savedDocument(storage))).toEqual(ingredientNames(demoCopy()));
    expect(screen.getAllByRole('status').map(node => node.textContent).join(' ')).toContain('Demo data restored.');
  });

  it('cancel in the reset dialog changes nothing', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    await userEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(storage.setCalls).toBe(0);
    expect(screen.getByText(/Now: 3 ingredients/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset to demo data' }));
  });

  it('start with empty data asks first, warns about backups, then removes everything', async () => {
    const storage = memoryStorage();
    await openData(storage);
    expect(screen.getByText(new RegExp(`Now: ${demoCopy().ingredients.length} ingredients`))).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Start with empty data' }));
    expect(storage.setCalls).toBe(0);
    const confirmation = await dialog();
    expect(within(confirmation).getByRole('heading', { name: 'Start with empty data?' })).toBeTruthy();
    expect(confirmation.textContent).toMatch(/Export a backup first/);
    await userEvent.click(within(confirmation).getByRole('button', { name: 'Start with empty data' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(savedDocument(storage)).toEqual({
      version: 1, settings: { defaultVatRateBp: 900 }, ingredients: [], recipes: [], scenarios: [],
    });
    expect(screen.getByText('Now: 0 ingredients, 0 recipes, 0 saved scenarios.')).toBeTruthy();
    expect(screen.getAllByRole('status').map(node => node.textContent).join(' ')).toMatch(/All data was removed/);
  });

  it('cancel in the start-with-empty-data dialog changes nothing', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    await userEvent.click(screen.getByRole('button', { name: 'Start with empty data' }));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(storage.setCalls).toBe(0);
    expect(screen.getByText(/Now: 3 ingredients/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start with empty data' }));
  });

  it('a failed write keeps the data and shows the reason in the dialog', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    storage.failOnSet = new Error('disk is full');
    await userEvent.click(screen.getByRole('button', { name: 'Start with empty data' }));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Start with empty data' }));
    expect(within(await dialog()).getByRole('alert').textContent).toMatch(/disk is full.*current data was not changed/i);
    expect(screen.getByText(/Now: 3 ingredients/)).toBeTruthy();
  });

  it('export, reset and import brings the exported data back', async () => {
    const storage = storageWith(sauceDoc());
    await openData(storage);
    await userEvent.click(screen.getByRole('button', { name: 'Export backup' }));
    await waitFor(() => expect(downloads).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Reset to demo data' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(ingredientNames(savedDocument(storage))).toEqual(ingredientNames(demoCopy()));

    await chooseFile(jsonFile(downloads[0]?.text ?? ''));
    await userEvent.click(within(await dialog()).getByRole('button', { name: 'Replace with backup' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(ingredientNames(savedDocument(storage))).toEqual(['Tomatoes', 'Spice mix', 'Saffron']);
  });
});

describe('unsaved simulator scenarios', () => {
  it('the dialog warns about them and replacing drops them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    try {
      const storage = memoryStorage();
      (await renderApp(storage));
      await go('#/simulator/dish_classic_burger');
      await userEvent.click(await screen.findByRole('button', { name: /Add scenario/ }));
      await go('#/data');
      await screen.findByRole('heading', { level: 1, name: 'Data' });

      await userEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }));
      expect(within(await dialog()).getByText(/1 unsaved simulator scenario\. They will be lost/)).toBeTruthy();
      await userEvent.click(within(await dialog()).getByRole('button', { name: 'Reset to demo data' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

      await userEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }));
      expect(within(await dialog()).queryByText(/unsaved simulator/)).toBeNull();

      // The same warning is shown before starting with empty data.
      await go('#/simulator/dish_classic_burger');
      await userEvent.click(await screen.findByRole('button', { name: /Add scenario/ }));
      await go('#/data');
      await userEvent.click(await screen.findByRole('button', { name: 'Start with empty data' }));
      expect(within(await dialog()).getByText(/1 unsaved simulator scenario\. They will be lost/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
