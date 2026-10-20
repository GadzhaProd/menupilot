import type { RecipeDraft } from '@/ui/forms/recipeForm';

const drafts = new Map<string, RecipeDraft>();

export function readRecipeDraft(key: string): RecipeDraft | undefined {
  return drafts.get(key);
}

export function writeRecipeDraft(key: string, draft: RecipeDraft): void {
  drafts.set(key, draft);
}

export function clearRecipeDraft(key: string): void {
  drafts.delete(key);
}

export function clearRecipeDrafts(): void {
  drafts.clear();
}
