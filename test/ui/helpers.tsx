import { StrictMode, type ReactNode } from 'react';
import { render } from '@testing-library/react';
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
