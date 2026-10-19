import { useMemo } from 'react';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDocument } from '@/ui/data/DataProvider';
import { dishRows, formatEURFromMicro } from '@/ui/domain/calc';
import { HelpLink } from '@/ui/help/HelpLink';
import { hrefFor } from '@/ui/router/routes';
import { useSimulatorSessions } from './session';

/** Step one: choose the dish to try what-if changes on. */
export function DishPicker() {
  const document = useDocument();
  const dishes = useMemo(() => dishRows(document), [document]);
  const sessions = useSimulatorSessions();
  const scenarioCount = (dishId: string) => document.scenarios.filter((scenario) => scenario.recipeId === dishId).length;

  return (
    <section aria-labelledby="page-title" className="space-y-4">
      <div className="space-y-1">
        <h1 id="page-title" className="text-2xl font-semibold">Simulator</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Choose a dish, then try a different menu price, ingredient price or quantity and compare it with today. Your real prices and recipes never change.
        </p>
        <HelpLink section="simulator" />
      </div>
      {dishes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">No dishes to simulate yet</p>
          <p className="text-sm text-muted-foreground">Add a dish with its ingredients first. Preps cannot be simulated on their own.</p>
          <Button asChild><a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}><PlusIcon aria-hidden="true" /> New dish</a></Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dishes.map((dish) => {
            const saved = scenarioCount(dish.id);
            const unsaved = sessions.unsavedCount(dish.id);
            return (
              <li key={dish.id}>
                <Card className="h-full gap-0 py-0 transition-shadow focus-within:ring-[3px] focus-within:ring-ring/50 hover:shadow-md">
                  <CardContent className="p-0">
                    <a
                      href={hrefFor({ name: 'simulator', id: dish.id })}
                      aria-label={`Simulate ${dish.name}`}
                      className="flex h-full flex-col gap-2 rounded-xl p-4 outline-none"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">{dish.name}</span>
                        <ArrowRightIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Recipe-based ingredient cost:{' '}
                        <span className="font-medium text-foreground">
                          {dish.status === 'error'
                            ? 'cannot calculate'
                            : dish.costPerPortionMicro === null ? 'cost unknown' : formatEURFromMicro(dish.costPerPortionMicro)}
                        </span>
                        {dish.status === 'error' ? null : ' per portion, excl. VAT'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {saved === 0 ? 'No saved scenarios' : `${saved} saved ${saved === 1 ? 'scenario' : 'scenarios'}`}
                        {unsaved > 0 ? <span className="font-medium text-amber-700"> · {unsaved} unsaved {unsaved === 1 ? 'scenario' : 'scenarios'}</span> : null}
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
