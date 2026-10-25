import { describe, expect, it } from 'vitest';
import { createRecipeDraftCache } from '../../src/ui/recipe/sessionDrafts';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('recipe draft session cache', () => {
  it('restores cached recipe drafts after the app is mounted again in the same tab', () => {
    const tab = storage();
    const draft = { draft: { name: 'Draft burger' }, baseline: { name: 'Burger' }, conflicts: [] } as never;
    createRecipeDraftCache(tab).write('recipe-1', draft);

    expect(createRecipeDraftCache(tab).read('recipe-1')).toEqual(draft);
  });

  it('clears the persisted recipe draft after it is saved or discarded', () => {
    const tab = storage();
    const cache = createRecipeDraftCache(tab);
    cache.write('recipe-1', { draft: {}, baseline: {}, conflicts: [] } as never);
    cache.clear('recipe-1');
    expect(createRecipeDraftCache(tab).read('recipe-1')).toBeUndefined();
  });

  it('remembers the active draft route for the next app mount', () => {
    const tab = storage();
    const cache = createRecipeDraftCache(tab);
    cache.write('new:dish', { draft: {}, baseline: {}, conflicts: [] } as never);
    expect(createRecipeDraftCache(tab).takeResumeRoute()).toBe('#/recipe/new?kind=dish');
  });
});
