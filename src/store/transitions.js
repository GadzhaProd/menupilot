import { StoreError } from './errors.js';

// Validation describes a state; these rules describe an ordinary edit. Replacements
// (import/reset/restore) are explicit operations and intentionally bypass this check.
export function assertValidTransition(previous, next) {
  const used = (kind, id) => previous.recipes.some(recipe =>
    recipe.lines.some(line => line.ref.kind === kind && line.ref.id === id));
  const refuse = message => { throw new StoreError('invalid-transition', message); };
  for (const old of previous.ingredients) {
    const current = next.ingredients.find(item => item.id === old.id);
    if (!current) {
      if (used('ingredient', old.id)) refuse(`Cannot delete '${old.name}' while it is referenced. Remove references in a separate save first.`);
      continue;
    }
    if (current.prices.length < old.prices.length || old.prices.some((price, index) =>
      Object.keys(price).some(key => price[key] !== current.prices[index]?.[key]))) {
      refuse(`The price history of '${old.name}' is append-only. Use Import to replace a dataset.`);
    }
    if (old.unit !== current.unit && (old.prices.length || used('ingredient', old.id))) {
      refuse(`The unit of '${old.name}' cannot change after prices or recipe references exist.`);
    }
  }
  for (const old of previous.recipes) {
    const current = next.recipes.find(item => item.id === old.id);
    if (!current && next.scenarios.some(scenario => scenario.recipeId === old.id)) {
      refuse(`Cannot delete '${old.name}' while its saved scenarios remain.`);
    }
    if (old.kind === 'prep' && used('prep', old.id) &&
      (!current || current.kind !== 'prep' || old.outputUnit !== current.outputUnit)) {
      refuse(`Cannot delete or change the output unit/kind of referenced prep '${old.name}'.`);
    }
  }
}
