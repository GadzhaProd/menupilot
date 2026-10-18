import { StrictMode, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import demo from '../../data/demo.json';
import { App } from '@/ui/App';
import { DataProvider } from '@/ui/data/DataProvider';
import { STORAGE_KEY, type StorageLike } from '@/ui/domain/store';

export { demo, STORAGE_KEY };

/** The same moment the demo data is written for, so the demo needs no date shift. */
export const NOW = '2026-10-18T12:00:00.000Z';

/** In-memory stand-in for localStorage; tests never touch a real one. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    data,
    failOnSet: null as Error | null,
    setCalls: 0,
    getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) {
      storage.setCalls += 1;
      if (storage.failOnSet) throw storage.failOnSet;
      data.set(key, String(value));
    },
  };
  return storage satisfies StorageLike;
}

export function renderApp(
  storage: StorageLike | null = memoryStorage(),
  { strict = false, children }: { strict?: boolean; children?: ReactNode } = {},
) {
  const tree = (
    <DataProvider storage={storage} demo={demo} now={() => NOW}>
      {children ?? <App />}
    </DataProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

/** A copy of the demo document that is easy to edit in a test. */
export function demoCopy() {
  return structuredClone(demo) as typeof demo;
}

/** Navigate like a click on a link: set the hash and let the router react. */
export async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

type Doc = ReturnType<typeof demoCopy>;

/** A small valid document for the manual example in 03 section 6 (tomatoes, spices, no recipes). */
export function sauceDoc(): Doc {
  const doc = demoCopy();
  const price = (cents: number) => [{ seq: 1, recordedAt: '2026-09-01T12:00:00.000Z', packPriceCents: cents, packSizeMilli: 1_000_000 }];
  doc.ingredients = [
    { id: 'ing_tomato', name: 'Tomatoes', unit: 'g', prices: price(200) },
    { id: 'ing_spice', name: 'Spice mix', unit: 'g', prices: price(1000) },
    { id: 'ing_noprice', name: 'Saffron', unit: 'g', prices: [] },
  ];
  doc.recipes = [];
  doc.scenarios = [];
  return doc;
}

export function storageWith(doc: Doc) {
  return memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) });
}

export function savedDocument(storage: ReturnType<typeof memoryStorage>) {
  return JSON.parse(storage.data.get(STORAGE_KEY) ?? 'null') as Doc;
}
