import { useMemo } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { useDocument } from '@/ui/data/DataProvider';
import { dishRows } from '@/ui/domain/calc';
import { prepRows, recipeCosts } from '@/ui/domain/recipeCosts';
import { HelpLink } from '@/ui/help/HelpLink';
import { hrefFor } from '@/ui/router/routes';
import { useLocale, useFormatters } from '@/ui/i18n';

/** Dishes and preps, each in its own list with the cost the owner cares about. */
export function RecipesPage() {
  const { t } = useLocale();
  const f = useFormatters();
  const document = useDocument();
  // Derived BigInt results: recomputed from the document, never stored.
  const dishes = useMemo(() => dishRows(document), [document]);
  const preps = useMemo(() => prepRows(document), [document]);
  const prepCosts = useMemo(() => new Map(document.recipes.filter((entry) => entry.kind === 'prep').map((entry) => [entry.id, recipeCosts(entry, document)])), [document]);

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-4xl font-semibold">{t('recipes.title')}</h1>
        <p className="max-w-prose text-muted-foreground">{t('recipes.intro')}</p>
        <HelpLink section="dishes" />
      </div>

      <Surface aria-labelledby="dish-list-title" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1"><h2 id="dish-list-title" className="text-xl font-semibold">{t('recipes.dishes')}</h2><p className="text-muted-foreground">{t('recipes.dishCost')}</p></div>
            <Button asChild>
              <a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}><PlusIcon aria-hidden="true" /> {t('recipes.newDish')}</a>
            </Button>
          </div>
          {dishes.length === 0 ? <EmptyState title={t('recipes.emptyDishTitle')} description={t('recipes.emptyDishDescription')} action={<Button asChild><a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}>{t('recipes.newDish')}</a></Button>} /> : (
            <>
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_minmax(9rem,auto)] gap-4 border-b pb-2 text-sm font-medium text-muted-foreground md:grid">
              <span>{t('recipes.dishName')}</span><span>{t('recipes.dishCostColumn')}</span><span>{t('recipes.foodCostExclVat')}</span>
            </div>
            <ul className="divide-y">
              {dishes.map((dish) => (
                <li key={dish.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 md:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_minmax(9rem,auto)] md:gap-4">
                  <a className="min-w-0 font-medium underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: dish.id })}>{dish.name}</a>
                  <span className="col-span-2 text-sm text-muted-foreground md:col-span-1 md:col-start-2">
                    <span className="mr-1 md:sr-only">{t('recipes.dishCostShort')}:</span>
                    {dish.status === 'error'
                      ? t('recipes.cannotCalculate')
                      : dish.costPerPortionMicro === null ? t('common.costUnknown') : f.microMoney(dish.costPerPortionMicro)}
                  </span>
                  <span className="col-start-2 row-start-1 shrink-0 text-right text-sm text-muted-foreground md:col-start-3 md:row-auto">
                    <span className="mr-1 md:sr-only">{t('recipes.foodCostShort')}:</span>
                    {dish.status === 'error'
                      ? t('recipes.cannotCalculate')
                      : dish.status === 'cost-unknown' ? t('common.costUnknown')
                        : dish.status === 'price-zero' ? t('common.notApplicable') : f.percent(dish.foodCostTenthsPct)}
                  </span>
                </li>
              ))}
            </ul>
            </>
          )}
      </Surface>

      <Surface aria-labelledby="prep-list-title" className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1"><h2 id="prep-list-title" className="text-xl font-semibold">{t('recipes.preps')}</h2><p className="text-muted-foreground">{t('recipes.prepCost')}</p></div>
            <Button asChild variant="outline">
              <a href={hrefFor({ name: 'recipe-new', kind: 'prep' })}><PlusIcon aria-hidden="true" /> {t('recipes.newPrep')}</a>
            </Button>
          </div>
          {preps.length === 0 ? <EmptyState title={t('recipes.emptyPrepTitle')} description={t('recipes.emptyPrepDescription')} action={<Button asChild variant="outline"><a href={hrefFor({ name: 'recipe-new', kind: 'prep' })}>{t('recipes.newPrep')}</a></Button>} /> : (
            <ul className="divide-y">
              {preps.map((prep) => (
                <li key={prep.id} className="flex items-center justify-between gap-4 py-2">
                  <a className="font-medium underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: prep.id })}>{prep.name}</a>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {(() => {
                      const source = document.recipes.find((entry) => entry.id === prep.id);
                      const result = prepCosts.get(prep.id);
                      if (prep.error || !source || source.kind !== 'prep' || !result || 'error' in result) return t('recipes.cannotCalculate');
                      return f.prepCost(result.batchCostMicro, source.outputMilli, source.outputUnit);
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Surface>
    </section>
  );
}
