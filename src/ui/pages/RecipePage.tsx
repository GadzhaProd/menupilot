import { useRef } from 'react';
import { useDocument } from '@/ui/data/DataProvider';
import type { Recipe } from '@/ui/domain/types';
import { RecipeEditor } from '@/ui/recipe/RecipeEditor';
import { NotFoundPage } from './NotFoundPage';

/** `id` is a saved recipe; `kind` (with no id) opens an empty form for a new dish or prep. */
export function RecipePage({ id, kind }: { id: string | null; kind?: 'dish' | 'prep' }) {
  const recipes = useDocument().recipes;
  const recipe = id === null ? null : recipes.find((entry) => entry.id === id) ?? null;
  // Deleting the recipe removes it from the data one moment before the address changes.
  const lastSeen = useRef<Recipe | null>(null);
  if (recipe) lastSeen.current = recipe;

  if (id === null) return <RecipeEditor key="new" recipe={null} kind={kind ?? 'dish'} />;
  if (!recipe) return lastSeen.current?.id === id ? null : <NotFoundPage what="recipe" />;
  return <RecipeEditor key={recipe.id} recipe={recipe} kind={recipe.kind} />;
}
