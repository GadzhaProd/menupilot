import { useLocale } from '@/ui/i18n';
import { Button } from '@/components/ui/button';
import { useDocument } from '@/ui/data/DataProvider';
import { HelpLink } from '@/ui/help/HelpLink';
import { DishPicker } from '@/ui/simulator/DishPicker';
import { Workbench } from '@/ui/simulator/Workbench';
import { hrefFor } from '@/ui/router/routes';

/** `#/simulator` picks a dish; `#/simulator/:id` is the simulator for that dish. */
export function SimulatorPage({ id }: { id: string | null }) {
  const { t } = useLocale();
  const { recipes } = useDocument();
  if (id === null) return <DishPicker />;

  const recipe = recipes.find((entry) => entry.id === id);
  if (!recipe) return <section className="space-y-4"><h1 className="text-3xl font-semibold">{t('simulator.notFound')}</h1><p>{t('simulator.missingDish')}</p><Button asChild><a href={hrefFor({ name: 'simulator', id: null })}>{t('simulator.choose')}</a></Button></section>;
  if (recipe.kind === 'prep') {
    return (
      <section aria-labelledby="page-title" className="space-y-4">
        <h1 id="page-title" className="text-2xl font-semibold">{t('simulator.prepTitle', { name: recipe.name })}</h1>
        <p role="status" className="max-w-2xl text-muted-foreground">
          {t('simulator.prepHint')}
        </p>
        <Button asChild><a href={hrefFor({ name: 'simulator', id: null })}>{t('simulator.choose')}</a></Button>
        <HelpLink section="simulator" className="block" />
      </section>
    );
  }
  return <Workbench key={recipe.id} dish={recipe} />;
}
