import { expect, it } from 'vitest';

// Warning-only during the parallel screen migration; remove exemptions only after merge.
it('inventories legacy UI money calls and n/a literals without blocking screen migration', () => {
  const sources = import.meta.glob<string>('/src/ui/**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' });
  expect(Object.keys(sources).length).toBeGreaterThan(0);
  const remaining = Object.entries(sources).flatMap(([path, source]) => {
    if (path.includes('/domain/') || path.includes('/i18n/')) return [];
    return source.split('\n').flatMap((line, index) =>
      /\bformatEURFrom(?:Cents|Micro)\s*\(|['"]n\/a['"]/.test(line) ? [`${path}:${index + 1}`] : []);
  }).sort();
  if (remaining.length) console.warn(`Screen migration: replace legacy money/n/a with useFormatters() or t():\n${remaining.join('\n')}`);
});
