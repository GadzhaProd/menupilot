import { Button } from '@/components/ui/button';
import { useDocument } from '@/ui/data/DataProvider';
import { HelpLink } from '@/ui/help/HelpLink';
import { DishPicker } from '@/ui/simulator/DishPicker';
import { Workbench } from '@/ui/simulator/Workbench';
import { hrefFor } from '@/ui/router/routes';
import { NotFoundPage } from './NotFoundPage';

/** `#/simulator` picks a dish; `#/simulator/:id` is the simulator for that dish. */
export function SimulatorPage({ id }: { id: string | null }) {
  const { recipes } = useDocument();
  if (id === null) return <DishPicker />;

  const recipe = recipes.find((entry) => entry.id === id);
  if (!recipe) return <NotFoundPage what="dish" />;
  if (recipe.kind === 'prep') {
    return (
      <section aria-labelledby="page-title" className="space-y-4">
        <h1 id="page-title" className="text-2xl font-semibold">{recipe.name} is a prep</h1>
        <p role="status" className="max-w-2xl text-muted-foreground">
          A prep is made in a batch and used inside dishes, so it has no menu price to simulate. Open a dish that uses it and change the prices of its ingredients there: the change flows through the prep.
        </p>
        <Button asChild><a href={hrefFor({ name: 'simulator', id: null })}>Choose a dish</a></Button>
        <HelpLink section="simulator" className="block" />
      </section>
    );
  }
  return <Workbench key={recipe.id} dish={recipe} />;
}
