import { useDocument } from '@/ui/data/DataProvider';
import { NotFoundPage } from './NotFoundPage';

/** Placeholder: recipe editing arrives in stage 4b. */
export function RecipePage({ id }: { id: string }) {
  const recipe = useDocument().recipes.find((entry) => entry.id === id);
  if (!recipe) return <NotFoundPage what="recipe" />;

  return (
    <section aria-labelledby="page-title" className="space-y-2">
      <h1 id="page-title" className="text-2xl font-semibold">{recipe.name}</h1>
      <p className="text-sm text-muted-foreground">
        {recipe.kind === 'dish' ? 'Dish' : 'Prep'} · {recipe.lines.length} lines. The recipe editor comes in the next stage.
      </p>
    </section>
  );
}
