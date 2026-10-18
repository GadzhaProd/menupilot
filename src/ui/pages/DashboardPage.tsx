import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDocument } from '@/ui/data/DataProvider';
import { dishRows, formatEURFromCents, formatEURFromMicro } from '@/ui/domain/calc';
import { hrefFor } from '@/ui/router/routes';

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
            <Table className="min-w-[36rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Dish</TableHead>
                  <TableHead className="text-right">Menu price (incl. VAT)</TableHead>
                  <TableHead className="text-right">Price (excl. VAT)</TableHead>
                  <TableHead className="text-right">Recipe-based ingredient cost (excl. VAT)</TableHead>
                  <TableHead className="text-right">Contribution (before other costs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <a className="underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: row.id })}>
                        {row.name}
                      </a>
                    </TableCell>
                    <TableCell className="text-right">{formatEURFromCents(row.menuPriceInclVatCents)}</TableCell>
                    <TableCell className="text-right">
                      {row.priceExclVatMicro === null ? '—' : formatEURFromMicro(row.priceExclVatMicro)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === 'error' ? (
                        <span className="text-destructive">Cannot calculate</span>
                      ) : row.costPerPortionMicro === null ? (
                        <span className="text-muted-foreground">cost unknown</span>
                      ) : (
                        formatEURFromMicro(row.costPerPortionMicro)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
