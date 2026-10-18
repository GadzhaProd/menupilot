import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDocument } from '@/ui/data/DataProvider';
import { packUnitPriceDisplay, selectPriceAtDate } from '@/ui/domain/calc';

/** Placeholder: lists ingredients with their current price. Editing arrives in stage 4b. */
export function IngredientsPage() {
  const { ingredients } = useDocument();

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-2xl font-semibold">Ingredients</h1>
        <p className="text-sm text-muted-foreground">Adding and changing ingredients and prices comes in the next stage.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Current supplier prices</CardTitle>
          <CardDescription>Supplier price excl. VAT, as on the invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          {ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingredients yet.</p>
          ) : (
            <Table className="min-w-[24rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Price excl. VAT (per kg, l or pc)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ingredient) => {
                  const price = selectPriceAtDate(ingredient.prices);
                  return (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell className="text-right">
                        {price === null
                          ? <span className="text-muted-foreground">no price yet</span>
                          : packUnitPriceDisplay(price.packPriceCents, price.packSizeMilli, ingredient.unit)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
