import { useMemo } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocument } from '@/ui/data/DataProvider';
import { dishRows, formatEURFromMicro } from '@/ui/domain/calc';
import { prepRows } from '@/ui/domain/recipeCosts';
import { HelpLink } from '@/ui/help/HelpLink';
import { hrefFor } from '@/ui/router/routes';

function EmptyList({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Dishes and preps, each in its own list with the cost the owner cares about. */
export function RecipesPage() {
  const document = useDocument();
  // Derived BigInt results: recomputed from the document, never stored.
  const dishes = useMemo(() => dishRows(document), [document]);
  const preps = useMemo(() => prepRows(document), [document]);

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-2xl font-semibold">Recipes</h1>
        <p className="text-sm text-muted-foreground">
          A dish is something on your menu. A prep is something you make in a batch and use in dishes, such as a sauce.
        </p>
        <HelpLink section="dishes" />
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Dishes</CardTitle>
            <CardDescription>Recipe-based ingredient cost per portion, excl. VAT.</CardDescription>
          </div>
          <Button asChild size="sm">
            <a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}><PlusIcon aria-hidden="true" /> New dish</a>
          </Button>
        </CardHeader>
        <CardContent>
          {dishes.length === 0 ? <EmptyList text="No dishes yet. Add your first dish." /> : (
            <ul className="divide-y">
              {dishes.map((dish) => (
                <li key={dish.id} className="flex items-center justify-between gap-4 py-2">
                  <a className="font-medium underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: dish.id })}>{dish.name}</a>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {dish.status === 'error'
                      ? 'cannot calculate'
                      : dish.costPerPortionMicro === null ? 'cost unknown' : formatEURFromMicro(dish.costPerPortionMicro)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>Preps</CardTitle>
            <CardDescription>Cost per kg, l or pc of what the batch makes, excl. VAT.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href={hrefFor({ name: 'recipe-new', kind: 'prep' })}><PlusIcon aria-hidden="true" /> New prep</a>
          </Button>
        </CardHeader>
        <CardContent>
          {preps.length === 0 ? <EmptyList text="No preps yet. A prep is a sauce, dough or stock that several dishes share." /> : (
            <ul className="divide-y">
              {preps.map((prep) => (
                <li key={prep.id} className="flex items-center justify-between gap-4 py-2">
                  <a className="font-medium underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: prep.id })}>{prep.name}</a>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {prep.error ? 'cannot calculate' : prep.unitCost ?? 'cost unknown'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
