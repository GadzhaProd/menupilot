import type { RecipeDraft } from '@/ui/forms/recipeForm';

const drafts = new Map<string, RecipeDraft>();
const sourceSnapshots = new Map<string, string>();

export function readRecipeDraft(key: string, sourceSnapshot: string): RecipeDraft | undefined {
  const draft = drafts.get(key);
  if (draft === undefined) return undefined;
  if (sourceSnapshots.get(key) !== sourceSnapshot) {
    clearRecipeDraft(key);
    return undefined;
  }
  return draft;
}

export function writeRecipeDraft(key: string, draft: RecipeDraft, sourceSnapshot: string): void {
  drafts.set(key, draft);
  sourceSnapshots.set(key, sourceSnapshot);
}

export function clearRecipeDraft(key: string): void {
  drafts.delete(key);
  sourceSnapshots.delete(key);
}

export function clearRecipeDrafts(): void {
  drafts.clear();
  sourceSnapshots.clear();
}
