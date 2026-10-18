import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDocument } from '@/ui/data/DataProvider';
import { formatEURFromCents, packUnitPriceDisplay, selectPriceAtDate } from '@/ui/domain/calc';
import type { Ingredient } from '@/ui/domain/types';
import { formatDate } from '@/ui/ingredients/format';
import {
  AddIngredientDialog, DeleteIngredientDialog, HistoryDialog, NewPriceDialog, RenameDialog,
} from '@/ui/ingredients/IngredientDialogs';
import { formatQuantity } from '@/ui/forms/numbers';
import { useDialogState } from '@/ui/hooks/useDialogState';

type Active =
  | { kind: 'add' }
  | { kind: 'price' | 'history' | 'rename' | 'delete'; id: string };

/** On phones each ingredient becomes a small card: the label comes from `data-label`. */
const STACKED_CELL = 'max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:py-1 max-sm:whitespace-normal max-sm:before:text-left max-sm:before:font-normal max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]';

function IngredientRow({ ingredient, onOpen }: {
  ingredient: Ingredient;
  onOpen: (kind: 'price' | 'history' | 'rename' | 'delete', event: { currentTarget: HTMLElement }) => void;
}) {
  const price = selectPriceAtDate(ingredient.prices);
  return (
    <TableRow className="max-sm:block max-sm:py-3">
      <TableCell className="font-medium whitespace-normal max-sm:block max-sm:pb-2 max-sm:text-base">{ingredient.name}</TableCell>
      <TableCell data-label="Unit" className={STACKED_CELL}>{ingredient.unit}</TableCell>
      {price === null ? (
        <TableCell colSpan={4} className="whitespace-normal text-muted-foreground max-sm:block">
          No price yet. Recipes using it show “cost unknown”.
        </TableCell>
      ) : (
        <>
          <TableCell data-label="Pack size" className={`text-right ${STACKED_CELL}`}>{formatQuantity(price.packSizeMilli, ingredient.unit)}</TableCell>
          <TableCell data-label="Pack price (excl. VAT)" className={`text-right ${STACKED_CELL}`}>{formatEURFromCents(price.packPriceCents)}</TableCell>
          <TableCell data-label="Price per kg, l or pc (excl. VAT)" className={`text-right ${STACKED_CELL}`}>
            {packUnitPriceDisplay(price.packPriceCents, price.packSizeMilli, ingredient.unit)}
          </TableCell>
          <TableCell data-label="Last price" className={`text-right ${STACKED_CELL}`}>{formatDate(price.recordedAt)}</TableCell>
        </>
      )}
      <TableCell className="max-sm:block max-sm:pt-2">
        <div className="flex flex-wrap justify-end gap-1 sm:flex-nowrap max-sm:justify-start">
          <Button size="sm" variant="outline" aria-label={`New price for ${ingredient.name}`} onClick={(event) => onOpen('price', event)}>New price</Button>
          <Button size="sm" variant="ghost" aria-label={`Price history of ${ingredient.name}`} onClick={(event) => onOpen('history', event)}>History</Button>
          <Button size="sm" variant="ghost" aria-label={`Rename ${ingredient.name}`} onClick={(event) => onOpen('rename', event)}>Rename</Button>
          <Button size="sm" variant="ghost" aria-label={`Delete ${ingredient.name}`} onClick={(event) => onOpen('delete', event)}>Delete</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function IngredientsPage() {
  const { ingredients } = useDocument();
  const dialog = useDialogState<Active>();
  const active = dialog.state;
  const target = active !== null && active.kind !== 'add' ? ingredients.find((entry) => entry.id === active.id) : undefined;
  const common = { onClose: dialog.close, onCloseAutoFocus: dialog.onCloseAutoFocus };

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 id="page-title" className="text-2xl font-semibold">Ingredients</h1>
          <p className="text-sm text-muted-foreground">
            What you buy and what it costs. When a supplier changes a price, add a new price: the old one stays in the history.
          </p>
        </div>
        <Button onClick={(event) => dialog.open({ kind: 'add' }, event)}>
          <PlusIcon aria-hidden="true" /> Add ingredient
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Current supplier prices</CardTitle>
          <CardDescription>Supplier price excl. VAT, as on the invoice. Also shown per kg, l or pc.</CardDescription>
        </CardHeader>
        <CardContent>
          {ingredients.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">No ingredients yet</p>
              <p className="text-sm text-muted-foreground">Add what you buy, then use it in your recipes.</p>
              <Button onClick={(event) => dialog.open({ kind: 'add' }, event)}>Add your first ingredient</Button>
            </div>
          ) : (
            <Table className="max-sm:block [&_tbody]:max-sm:block">
              <TableHeader className="max-sm:sr-only">
                <TableRow>
                  <TableHead className="whitespace-normal">Ingredient</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="whitespace-normal text-right">Pack size</TableHead>
                  <TableHead className="whitespace-normal text-right">Pack price (excl. VAT)</TableHead>
                  <TableHead className="whitespace-normal text-right">Price per kg, l or pc (excl. VAT)</TableHead>
                  <TableHead className="whitespace-normal text-right">Last price</TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
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
        </CardContent>
      </Card>

      {active?.kind === 'add' ? <AddIngredientDialog {...common} /> : null}
      {target && active?.kind === 'price' ? <NewPriceDialog ingredient={target} {...common} /> : null}
      {target && active?.kind === 'history' ? <HistoryDialog ingredient={target} {...common} /> : null}
      {target && active?.kind === 'rename' ? <RenameDialog ingredient={target} {...common} /> : null}
      {target && active?.kind === 'delete' ? <DeleteIngredientDialog ingredient={target} {...common} /> : null}
    </section>
  );
}
