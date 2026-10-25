import type { MenuDocument } from '@/ui/domain/types';

export interface VersionChange { readonly name: string; readonly kind: 'dish' | 'prep' | 'ingredient' | 'newPrice' | 'scenario' | 'settings' }

/** Describes named entries that differ between a saved version and its successor. */
export function describeVersionChanges(previous: MenuDocument, next: MenuDocument): VersionChange[] {
  const changes: VersionChange[] = [];
  const compare = <T extends { id: string; name?: string }>(before: readonly T[], after: readonly T[], kind: VersionChange['kind']) => {
    const old = new Map(before.map(item => [item.id, JSON.stringify(item)]));
    const previousById = new Map(before.map(item => [item.id, item]));
    const current = new Map(after.map(item => [item.id, item]));
    for (const id of new Set([...old.keys(), ...current.keys()])) {
      if (old.get(id) !== (current.has(id) ? JSON.stringify(current.get(id)) : undefined)) {
        const item = current.get(id) ?? previousById.get(id)!;
        let changeKind = kind;
        if (kind === 'ingredient' && current.has(id) && previousById.has(id)) {
          const before = previousById.get(id) as T & { prices?: readonly unknown[] };
          const after = current.get(id) as T & { prices?: readonly unknown[] };
          const beforeBase = { ...before, prices: undefined };
          const afterBase = { ...after, prices: undefined };
          const oldPrices = before.prices ?? [];
          const newPrices = after.prices ?? [];
          if (JSON.stringify(beforeBase) === JSON.stringify(afterBase) && newPrices.length > oldPrices.length
            && oldPrices.every((price, index) => JSON.stringify(price) === JSON.stringify(newPrices[index]))) changeKind = 'newPrice';
        }
        changes.push({ name: item.name ?? id, kind: changeKind });
      }
    }
  };
  const beforeRecipes = new Map(previous.recipes.map(recipe => [recipe.id, recipe]));
  const afterRecipes = new Map(next.recipes.map(recipe => [recipe.id, recipe]));
  const oldRecipes = new Map(previous.recipes.map(recipe => [recipe.id, JSON.stringify(recipe)]));
  for (const id of new Set([...oldRecipes.keys(), ...afterRecipes.keys()])) {
    if (oldRecipes.get(id) !== (afterRecipes.has(id) ? JSON.stringify(afterRecipes.get(id)) : undefined)) {
      const recipe = afterRecipes.get(id) ?? beforeRecipes.get(id)!;
      changes.push({ name: recipe.name, kind: recipe.kind });
    }
  }
  compare(previous.ingredients, next.ingredients, 'ingredient');
  compare(previous.scenarios, next.scenarios, 'scenario');
  if (JSON.stringify(previous.settings) !== JSON.stringify(next.settings)) changes.push({ name: '', kind: 'settings' });
  return changes;
}

export function summarizeVersionChanges(changes: readonly VersionChange[], labels: Record<VersionChange['kind'], string>, more: (count: number) => string, settingsName: string): string {
  const shown = changes.slice(0, 3).map(change => change.kind === 'settings' ? settingsName : `${change.name} (${labels[change.kind]})`);
  if (changes.length > 3) shown.push(more(changes.length - 3));
  return shown.join(', ');
}
