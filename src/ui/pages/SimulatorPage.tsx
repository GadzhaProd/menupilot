import { useDocument } from '@/ui/data/DataProvider';
import { hrefFor } from '@/ui/router/routes';
import { NotFoundPage } from './NotFoundPage';

/** Placeholder: the Profit Simulator arrives in stage 6. Without an id it lets you pick a dish. */
export function SimulatorPage({ id }: { id: string | null }) {
  const { recipes } = useDocument();

  if (id === null) {
    const dishes = recipes.filter((recipe) => recipe.kind === 'dish');
    return (
      <section aria-labelledby="page-title" className="space-y-4">
        <h1 id="page-title" className="text-2xl font-semibold">Simulator</h1>
        <p className="text-sm text-muted-foreground">Choose a dish to try what-if scenarios on.</p>
        <ul className="space-y-1">
          {dishes.map((dish) => (
            <li key={dish.id}>
              <a className="underline underline-offset-4" href={hrefFor({ name: 'simulator', id: dish.id })}>{dish.name}</a>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const dish = recipes.find((recipe) => recipe.id === id && recipe.kind === 'dish');
  if (!dish) return <NotFoundPage what="dish" />;

  return (
    <section aria-labelledby="page-title" className="space-y-2">
      <h1 id="page-title" className="text-2xl font-semibold">Simulator: {dish.name}</h1>
      <p className="text-sm text-muted-foreground">The Profit Simulator comes in a later stage.</p>
    </section>
  );
}
