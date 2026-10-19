import { useLocale, useFormatters } from '@/ui/i18n';
import { useMemo } from 'react';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDocument } from '@/ui/data/DataProvider';
import { dishRows } from '@/ui/domain/calc';
import { HelpLink } from '@/ui/help/HelpLink';
import { hrefFor } from '@/ui/router/routes';
import { useSimulatorSessions } from './session';

/** Step one: choose the dish to try what-if changes on. */
export function DishPicker() {
  const { t, plural } = useLocale(); const f = useFormatters();
  const document = useDocument();
  const dishes = useMemo(() => dishRows(document), [document]);
  const sessions = useSimulatorSessions();
  const scenarioCount = (dishId: string) => document.scenarios.filter((scenario) => scenario.recipeId === dishId).length;

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div className="space-y-1">
        <h1 id="page-title" className="text-[31px] leading-tight font-semibold sm:text-4xl">{t('simulator.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t('simulator.chooseIntro')}
        </p>
        <HelpLink section="simulator" />
      </div>
      {dishes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">{t('simulator.emptyDishes')}</p>
          <p className="text-sm text-muted-foreground">{t('simulator.emptyHint')}</p>
          <Button asChild><a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}><PlusIcon aria-hidden="true" /> {t('simulator.newDish')}</a></Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.map((dish) => {
            const saved = scenarioCount(dish.id);
            const unsaved = sessions.unsavedCount(dish.id);
            return (
              <li key={dish.id}>
                <Card className="h-full gap-0 py-0 hover:bg-panel">
                  <CardContent className="p-0">
                    <a
                      href={hrefFor({ name: 'simulator', id: dish.id })}
                      aria-label={t('simulator.simulate', { name: dish.name })}
                      className="flex h-full flex-col gap-2 rounded p-5"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">{dish.name}</span>
                        <ArrowRightIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t('simulator.cost')}:{' '}
                        <span className="font-medium text-foreground">
                          {dish.status === 'error'
                            ? t('simulator.cannotCalculate')
                            : dish.costPerPortionMicro === null ? t('common.costUnknown') : f.microMoney(dish.costPerPortionMicro)}
                        </span>
                        {dish.status === 'error' ? null : ` ${t('simulator.portionHint')}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {saved === 0 ? t('simulator.noSaved') : plural('simulator.saved', saved, { count: f.integer(saved) })}
                        {unsaved > 0 ? <span className="font-medium text-accent-foreground"> · {plural('simulator.unsaved', unsaved, { count: f.integer(unsaved) })}</span> : null}
                      </span>
                    </a>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
