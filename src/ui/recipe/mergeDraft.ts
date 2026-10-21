import type { RecipeDraft } from '@/ui/forms/recipeForm';

export type DraftField = Exclude<keyof RecipeDraft, 'outputQty' | 'outputUnit'>;
type Output = Pick<RecipeDraft, 'outputQty' | 'outputUnit'>;
export type DraftConflict =
  | { field: DraftField; local: RecipeDraft[DraftField]; latest: RecipeDraft[DraftField] }
  | { field: 'output'; local: Output; latest: Output };
export interface CachedRecipeDraft { draft: RecipeDraft; baseline: RecipeDraft; conflicts: DraftConflict[] }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const output = ({ outputQty, outputUnit }: RecipeDraft): Output => ({ outputQty, outputUnit });

/** Lines and prep output are indivisible fields, including their conflict choices. */
export function mergeDraft(base: RecipeDraft, local: RecipeDraft, latest: RecipeDraft, pending: DraftConflict[] = []) {
  const draft = { ...latest };
  const conflicts: DraftConflict[] = [];
  for (const field of Object.keys(base) as (keyof RecipeDraft)[]) {
    if (field === 'outputQty' || field === 'outputUnit') continue;
    const ours = local[field], theirs = latest[field];
    if (equal(ours, base[field])) continue;
    Object.assign(draft, { [field]: ours });
    if (!equal(theirs, ours) && (!equal(theirs, base[field]) || pending.some(c => c.field === field))) {
      conflicts.push({ field, local: ours, latest: theirs });
    }
  }
  const ours = output(local), theirs = output(latest), original = output(base);
  if (!equal(ours, original)) {
    Object.assign(draft, ours);
    if (!equal(theirs, ours) && (!equal(theirs, original) || pending.some(c => c.field === 'output'))) {
      conflicts.push({ field: 'output', local: ours, latest: theirs });
    }
  }
  return { draft, baseline: latest, conflicts };
}
