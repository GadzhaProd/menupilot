import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDocument } from '@/ui/data/DataProvider';
import { selectPriceAtDate } from '@/ui/domain/calc';
import type { Ingredient } from '@/ui/domain/types';
import {
  AddIngredientDialog, DeleteIngredientDialog, HistoryDialog, NewPriceDialog, RenameDialog,
} from '@/ui/ingredients/IngredientDialogs';
import { formatQuantityLocale, localizedUnit } from '@/ui/forms/numbers';
import { HelpLink } from '@/ui/help/HelpLink';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useLocale, useFormatters } from '@/ui/i18n';

type Active =
  | { kind: 'add' }
  | { kind: 'price' | 'history' | 'rename' | 'delete'; id: string };

/** On phones each ingredient becomes a small card: the label comes from `data-label`. */
const STACKED_CELL = 'max-xl:flex max-xl:justify-between max-xl:gap-4 max-xl:py-1 max-xl:whitespace-normal max-xl:before:text-left max-xl:before:font-normal max-xl:before:text-muted-foreground max-xl:before:content-[attr(data-label)]';

function IngredientRow({ ingredient, onOpen }: {
  ingredient: Ingredient;
  onOpen: (kind: 'price' | 'history' | 'rename' | 'delete', event: { currentTarget: HTMLElement }) => void;
}) {
  const { t, locale } = useLocale();
  const f = useFormatters();
  const price = selectPriceAtDate(ingredient.prices);
  return (
    <TableRow className="max-xl:block max-xl:py-3">
      <TableCell className="font-medium whitespace-normal max-xl:block max-xl:pb-2 max-xl:text-base">{ingredient.name}</TableCell>
      <TableCell data-label={t('ingredients.unit')} className={STACKED_CELL}>{localizedUnit(ingredient.unit, locale)}</TableCell>
      {price === null ? (
        <TableCell colSpan={4} className="whitespace-normal text-muted-foreground max-xl:block">
          {t('ingredients.noPrice')}
        </TableCell>
      ) : (
        <>
          <TableCell data-label={t('ingredients.packSize')} className={`text-right ${STACKED_CELL}`}>{formatQuantityLocale(price.packSizeMilli, ingredient.unit, locale)}</TableCell>
          <TableCell data-label={t('ingredients.packPrice')} className={`text-right ${STACKED_CELL}`}>{f.money(price.packPriceCents)}</TableCell>
          <TableCell data-label={t('ingredients.unitPrice')} className={`text-right ${STACKED_CELL}`}>
            {f.packPrice(price.packPriceCents, price.packSizeMilli, ingredient.unit)}
          </TableCell>
          <TableCell data-label={t('ingredients.lastPrice')} className={`text-right ${STACKED_CELL}`}>{f.date(price.recordedAt)}</TableCell>
        </>
      )}
      <TableCell className="max-xl:block max-xl:pt-2">
        <div className="flex flex-wrap justify-end gap-1 xl:flex-nowrap max-xl:justify-start">
          <Button size="sm" variant="outline" aria-label={t('ingredients.newPriceAction', { name: ingredient.name })} onClick={(event) => onOpen('price', event)}>{t('ingredients.newPrice')}</Button>
          <Button size="sm" variant="ghost" aria-label={t('ingredients.historyFor', { name: ingredient.name })} onClick={(event) => onOpen('history', event)}>{t('ingredients.priceHistory')}</Button>
          <Button size="sm" variant="ghost" aria-label={t('ingredients.renameFor', { name: ingredient.name })} onClick={(event) => onOpen('rename', event)}>{t('ingredients.rename')}</Button>
          <Button size="sm" variant="ghost" aria-label={t('ingredients.deleteFor', { name: ingredient.name })} onClick={(event) => onOpen('delete', event)}>{t('ingredients.delete')}</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function IngredientsPage() {
  const { t } = useLocale();
  const { ingredients } = useDocument();
  const dialog = useDialogState<Active>();
  const active = dialog.state;
  const target = active !== null && active.kind !== 'add' ? ingredients.find((entry) => entry.id === active.id) : undefined;
  const common = { onClose: dialog.close, onCloseAutoFocus: dialog.onCloseAutoFocus };

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 id="page-title" className="text-4xl font-semibold">{t('ingredients.title')}</h1>
          <p className="max-w-prose text-muted-foreground">{t('ingredients.intro')}</p>
          <HelpLink section="ingredients" />
        </div>
        <Button onClick={(event) => dialog.open({ kind: 'add' }, event)}>
          <PlusIcon aria-hidden="true" /> {t('ingredients.add')}
        </Button>
      </div>
      <Surface aria-labelledby="supplier-prices-title" className="space-y-5">
          <div className="space-y-1"><h2 id="supplier-prices-title" className="text-xl font-semibold">{t('ingredients.currentPrices')}</h2><p className="text-muted-foreground">{t('ingredients.priceDescription')}</p></div>
          {ingredients.length === 0 ? (
            <EmptyState title={t('ingredients.emptyTitle')} description={t('ingredients.emptyDescription')} action={<Button onClick={(event) => dialog.open({ kind: 'add' }, event)}>{t('ingredients.addFirst')}</Button>} />
          ) : (
            <Table className="max-xl:block [&_tbody]:max-xl:block">
              <TableHeader className="max-xl:sr-only">
                <TableRow>
                  <TableHead className="whitespace-normal">{t('ingredients.name')}</TableHead>
                  <TableHead>{t('ingredients.unit')}</TableHead>
                  <TableHead className="whitespace-normal text-right">{t('ingredients.packSize')}</TableHead>
                  <TableHead className="whitespace-normal text-right">{t('ingredients.packPrice')}</TableHead>
                  <TableHead className="whitespace-normal text-right">{t('ingredients.unitPrice')}</TableHead>
                  <TableHead className="whitespace-normal text-right">{t('ingredients.lastPrice')}</TableHead>
                  <TableHead><span className="sr-only">{t('ingredients.actions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => (
                  <IngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    onOpen={(kind, event) => dialog.open({ kind, id: ingredient.id }, event)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
      </Surface>

      {active?.kind === 'add' ? <AddIngredientDialog {...common} /> : null}
      {target && active?.kind === 'price' ? <NewPriceDialog ingredient={target} {...common} /> : null}
      {target && active?.kind === 'history' ? <HistoryDialog ingredient={target} {...common} /> : null}
      {target && active?.kind === 'rename' ? <RenameDialog ingredient={target} {...common} /> : null}
      {target && active?.kind === 'delete' ? <DeleteIngredientDialog ingredient={target} {...common} /> : null}
    </section>
  );
}
