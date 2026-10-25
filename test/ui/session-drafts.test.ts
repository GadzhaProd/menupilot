import { describe, expect, it } from 'vitest';
import { attachUnassignedRecipeDrafts, createRecipeDraftCache, hasAnyRecipeDrafts } from '../../src/ui/recipe/sessionDrafts';

function storage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const draft = (name: string) => ({ draft: { name }, baseline: { name: '' }, conflicts: [] }) as never;

describe('recipe draft browser cache', () => {
  it('keeps drafts isolated by document identity', () => {
    const browser = storage();
    createRecipeDraftCache(browser, 'document-a').write('new:dish', draft('A dish'));
    expect(createRecipeDraftCache(browser, 'document-b').list()).toEqual([]);
    expect(createRecipeDraftCache(browser, 'document-a').list()).toMatchObject([{ key: 'new:dish', name: 'A dish', route: '#/recipe/new?kind=dish' }]);
  });

  it('detects saved drafts across document identities while a tab is out of its editor', () => {
    const browser = storage();
    createRecipeDraftCache(browser, 'document-a').write('new:dish', draft('A dish'));
    expect(hasAnyRecipeDrafts(browser)).toBe(true);
    createRecipeDraftCache(browser, 'document-a').clear('new:dish');
    expect(hasAnyRecipeDrafts(browser)).toBe(false);
  });

  it('moves an initially unassigned draft when the browser assigns the document identity', () => {
    const browser = storage();
    createRecipeDraftCache(browser, null).write('new:dish', draft('A dish'));
    attachUnassignedRecipeDrafts('document-a', browser);
    expect(createRecipeDraftCache(browser, 'document-a').list()).toMatchObject([{ key: 'new:dish', name: 'A dish' }]);
    expect(createRecipeDraftCache(browser, null).list()).toEqual([]);
  });

  it('updates and removes independent entries without replacing other tabs’ drafts', () => {
    const browser = storage();
    const first = createRecipeDraftCache(browser, 'document-a');
    const second = createRecipeDraftCache(browser, 'document-a');
    first.write('new:dish', draft('Dish'));
    second.write('recipe-1', draft('Soup'));
    first.write('new:dish', draft('Dish updated'));
    first.clear('new:dish');
    expect(createRecipeDraftCache(browser, 'document-a').list()).toMatchObject([{ key: 'recipe-1', name: 'Soup' }]);
  });

  it('deletes drafts after seven days and excludes them from the draft list', () => {
    const browser = storage();
    const now = 1_800_000_000_000;
    createRecipeDraftCache(browser, 'document-a', { now: () => now }).write('new:prep', draft('Sauce'));
    const expired = createRecipeDraftCache(browser, 'document-a', { now: () => now + 7 * 24 * 60 * 60 * 1000 + 1 });
    expect(expired.list()).toEqual([]);
    expect(browser.length).toBe(0);
  });

  it('clears only the requested document and recipe draft', () => {
    const browser = storage();
    createRecipeDraftCache(browser, 'document-a').write('recipe-1', draft('Soup'));
    createRecipeDraftCache(browser, 'document-a').write('recipe-2', draft('Salad'));
    createRecipeDraftCache(browser, 'document-b').write('recipe-1', draft('Other soup'));
    createRecipeDraftCache(browser, 'document-a').clear('recipe-1');
    expect(createRecipeDraftCache(browser, 'document-a').list()).toMatchObject([{ key: 'recipe-2', name: 'Salad' }]);
    expect(createRecipeDraftCache(browser, 'document-b').list()).toMatchObject([{ key: 'recipe-1', name: 'Other soup' }]);
  });
});
