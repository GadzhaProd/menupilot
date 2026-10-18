import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { highestMonthly, type Run, type ScenarioDelta } from '@/ui/domain/simulator';
import type { SimulateResult } from '@/ui/domain/types';
import {
  costText, DASH, Delta, euro, percentText, signedEuro, signedPoints,
} from './format';

export interface Column {
  key: string;
  label: string;
  kind: 'baseline' | 'scenario';
  run: Run;
  /** Differences against Baseline; null for Baseline itself, a failed run or an out-of-date scenario. */
  delta: ScenarioDelta | null;
  /** Calculated on older data than Baseline: its differences are not shown. */
  stale: boolean;
}

interface Row {
  label: string;
  hint?: string;
  value: (result: SimulateResult) => ReactNode;
  delta?: (delta: ScenarioDelta) => ReactNode;
  emphasis?: boolean;
}

const ROWS: Row[] = [
  { label: 'Menu price (incl. VAT)', value: (r) => euro(r.menuPriceInclVatCents) },
  { label: 'Price excl. VAT', hint: 'all calculations use this', value: (r) => euro(r.netPriceCents) },
  {
    label: 'Recipe-based ingredient cost',
    hint: 'per portion, excl. VAT',
    value: costText,
    delta: (d) => <Delta value={d.ingredientCostDeltaCents} format={signedEuro} better="lower" />,
  },
  {
    label: 'Contribution per portion',
    hint: 'before other costs',
    value: (r) => euro(r.contributionCents),
    delta: (d) => <Delta value={d.contributionDeltaCents} format={signedEuro} better="higher" />,
  },
  {
    label: 'Food cost %',
    value: (r) => percentText(r, r.foodCostPct),
    delta: (d) => <Delta value={d.foodCostDeltaTenthsPct} format={signedPoints} better="lower" />,
  },
  { label: 'Contribution margin %', value: (r) => percentText(r, r.marginPct) },
  { label: 'Sales per month', hint: 'your estimate', value: (r) => (r.monthlyVolume === null ? DASH : String(r.monthlyVolume)) },
  {
    label: 'Estimated monthly contribution',
    hint: 'based on your sales estimate',
    value: (r) => euro(r.monthlyContributionCents),
    delta: (d) => <Delta value={d.monthlyContributionDeltaCents} format={signedEuro} better="higher" />,
    emphasis: true,
  },
];

export const DISCLAIMER = 'Scenarios are calculations based on your inputs, not forecasts. Changing quantities may affect quality, food safety or allergen information — check before changing a recipe.';

/** A scenario on older data does not take part in the comparison of monthly figures. */
const monthlyOf = (column: Column) => ({
  key: column.key,
  monthlyCents: column.run.ok && !column.stale ? column.run.result.monthlyContributionCents : null,
});

/** The best column in words: a calculation result, never advice to change a recipe. */
function Highest({ columns }: { columns: readonly Column[] }) {
  const best = highestMonthly(columns.map(monthlyOf));
  if (best === null) {
    return <p className="text-sm text-muted-foreground">Enter your sales per month to compare monthly contribution.</p>;
  }
  const names = columns.filter((column) => best.keys.includes(column.key)).map((column) => column.label);
  const tie = names.length > 1;
  const baselineOnly = names.length === 1 && best.keys[0] === 'baseline';
  return (
    <p data-testid="highest-monthly" className="rounded-md bg-accent/60 px-3 py-2 text-sm">
      {baselineOnly
        ? <><strong>Baseline</strong> has the highest estimated monthly contribution ({euro(best.cents)}) of the columns shown.</>
        : tie
          ? <><strong>{names.join(' and ')}</strong> are tied for the highest estimated monthly contribution ({euro(best.cents)}).</>
          : <><strong>{names[0]}</strong> has the highest estimated monthly contribution ({euro(best.cents)}) at your sales estimate.</>}
    </p>
  );
}

/** Baseline next to the scenarios, with the difference in euros per portion and per month. */
export function ComparisonTable({ columns }: { columns: readonly Column[] }) {
  const best = highestMonthly(columns.map(monthlyOf));
  const winners = new Set(best !== null && best.keys.length < columns.length ? best.keys : []);
  const anyStale = columns.some((column) => column.stale);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare</CardTitle>
        <CardDescription>
          Baseline is your real data today. Differences are against Baseline, per portion and per month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Highest columns={columns} />
        <Table className="min-w-[34rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 w-44 bg-card">Per portion, excl. VAT</TableHead>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  scope="col"
                  className={cn('min-w-28 whitespace-normal text-right', winners.has(column.key) && 'bg-accent/60')}
                >
                  <span className="block font-semibold text-foreground">{column.label}</span>
                  {column.kind === 'baseline' ? <span className="block text-xs font-normal text-muted-foreground">today</span> : null}
                  {column.stale ? <span className="block text-xs font-normal text-amber-700">older prices</span> : null}
                  {!column.run.ok ? <span className="block text-xs font-normal text-destructive">cannot calculate</span> : null}
                  {winners.has(column.key) ? <span className="block text-xs font-medium text-primary">highest monthly</span> : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.label} className={row.emphasis ? 'bg-secondary/40 font-medium' : undefined}>
                <TableHead scope="row" className={cn('sticky left-0 z-10 whitespace-normal font-normal', row.emphasis ? 'bg-secondary text-foreground' : 'bg-card text-foreground')}>
                  <span className={row.emphasis ? 'font-semibold' : undefined}>{row.label}</span>
                  {row.hint ? <span className="block text-xs font-normal text-muted-foreground">{row.hint}</span> : null}
                </TableHead>
                {columns.map((column) => (
                  <TableCell key={column.key} className={cn('text-right align-top', winners.has(column.key) && 'bg-accent/40')}>
                    {column.run.ok ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="tabular-nums">{row.value(column.run.result)}</span>
                        {row.delta && column.delta ? row.delta(column.delta) : null}
                      </div>
                    ) : DASH}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {anyStale ? (
          <p className="text-xs text-muted-foreground">
            A scenario marked “older prices” was saved before your recipes or prices changed. Use “Update baseline” on it to compare again.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}
