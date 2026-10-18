import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDocument } from '@/ui/data/DataProvider';
import { dishRows, formatEURFromCents, formatEURFromMicro } from '@/ui/domain/calc';
import { hrefFor } from '@/ui/router/routes';

/**
 * On phones each dish becomes a small card: the cell label is shown from `data-label`
 * (the column headers stay in the DOM for screen readers and wide screens).
 */
const STACKED_CELL = 'max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:py-1 max-sm:whitespace-normal max-sm:before:text-left max-sm:before:font-normal max-sm:before:text-muted-foreground max-sm:before:content-[attr(data-label)]';

export function DashboardPage() {
  const document = useDocument();
  // Derived BigInt results: recomputed from the document, never stored.
  const rows = useMemo(() => dishRows(document), [document]);

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Costs are calculated from your recipes at the latest ingredient prices, not from actual usage.
          Prices are excl. VAT unless marked incl. VAT.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dishes</CardTitle>
          <CardDescription>Per portion. Contribution is before other costs such as staff, rent and waste.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dishes yet.</p>
          ) : (
            <Table className="max-sm:block [&_tbody]:max-sm:block">
              <TableHeader className="max-sm:sr-only">
                <TableRow>
                  <TableHead className="whitespace-normal">Dish</TableHead>
                  <TableHead className="whitespace-normal text-right">Menu price (incl. VAT)</TableHead>
                  <TableHead className="whitespace-normal text-right">Price (excl. VAT)</TableHead>
                  <TableHead className="whitespace-normal text-right">Recipe-based ingredient cost (excl. VAT)</TableHead>
                  <TableHead className="whitespace-normal text-right">Contribution (before other costs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="max-sm:block max-sm:py-3">
                    <TableCell className="font-medium max-sm:block max-sm:pb-2 max-sm:text-base">
                      <a className="underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: row.id })}>
                        {row.name}
                      </a>
                    </TableCell>
                    <TableCell data-label="Menu price (incl. VAT)" className={`text-right ${STACKED_CELL}`}>{formatEURFromCents(row.menuPriceInclVatCents)}</TableCell>
                    <TableCell data-label="Price (excl. VAT)" className={`text-right ${STACKED_CELL}`}>
                      {row.priceExclVatMicro === null ? '—' : formatEURFromMicro(row.priceExclVatMicro)}
                    </TableCell>
                    <TableCell data-label="Recipe-based ingredient cost (excl. VAT)" className={`text-right ${STACKED_CELL}`}>
                      {row.status === 'error' ? (
                        <span className="text-destructive">Cannot calculate</span>
                      ) : row.costPerPortionMicro === null ? (
                        <span className="text-muted-foreground">cost unknown</span>
                      ) : (
                        formatEURFromMicro(row.costPerPortionMicro)
                      )}
                    </TableCell>
                    <TableCell data-label="Contribution (before other costs)" className={`text-right ${STACKED_CELL}`}>
                      {row.contributionMicro === null ? '—' : formatEURFromMicro(row.contributionMicro)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
