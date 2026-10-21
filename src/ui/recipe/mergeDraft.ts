import type { RecipeDraft } from '@/ui/forms/recipeForm';

export type DraftField = keyof RecipeDraft;
export interface DraftConflict { field: DraftField; local: RecipeDraft[DraftField]; latest: RecipeDraft[DraftField] }
export interface CachedRecipeDraft { draft: RecipeDraft; baseline: RecipeDraft; conflicts: DraftConflict[] }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Lines are one field; quantities and units stay together when either changes. */
export function mergeDraft(base: RecipeDraft, local: RecipeDraft, latest: RecipeDraft, pending: DraftConflict[] = []) {
  const draft = { ...latest };
  const conflicts: DraftConflict[] = [];
  for (const field of Object.keys(base) as DraftField[]) {
    const ours = local[field], theirs = latest[field];
    if (equal(ours, base[field])) continue;
    Object.assign(draft, { [field]: ours });
    if (!equal(theirs, ours) && (!equal(theirs, base[field]) || pending.some(c => c.field === field))) {
      conflicts.push({ field, local: ours, latest: theirs });
    }
  }
  // The output quantity and its unit form one value, never mix different unit systems.
  if (local.outputQty !== base.outputQty || local.outputUnit !== base.outputUnit) {
    draft.outputQty = local.outputQty; draft.outputUnit = local.outputUnit;
    if ((latest.outputQty !== base.outputQty || latest.outputUnit !== base.outputUnit)
      && (latest.outputQty !== local.outputQty || latest.outputUnit !== local.outputUnit)) {
      for (const field of ['outputQty', 'outputUnit'] as const) {
        if (!conflicts.some(c => c.field === field)) conflicts.push({ field, local: local[field], latest: latest[field] });
      }
    }
  }
  return { draft, baseline: latest, conflicts };
}
