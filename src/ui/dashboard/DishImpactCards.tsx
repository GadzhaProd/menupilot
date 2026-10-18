import { formatEURFromCents } from '@/ui/domain/calc';
import type { DashboardDishRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';
import {
  comparisonStatus,
  formatCostChange,
  formatCurrentContribution,
  formatCurrentCost,
  formatHistoricalCost,
  formatMoney,
  formatMonthlyImpact,
  formatPoints,
} from './format';

interface DishImpactCardsProps {
  rows: readonly DashboardDishRow[];
}

function metricRows(row: DashboardDishRow) {
  const status = comparisonStatus(row);
  return [
    ['Menu price (incl. VAT)', formatEURFromCents(row.menuPriceInclVatCents)],
    ['Price (excl. VAT)', formatMoney(row.priceExclVatMicro)],
    ['Recipe-based ingredient cost at comparison date (excl. VAT)',
      formatHistoricalCost(row)],
    ['Recipe-based ingredient cost now (excl. VAT)', formatCurrentCost(row)],
    ['Change (€)', formatCostChange(row)],
    ['Food cost change (pts)', status ?? formatPoints(row.foodCostDeltaTenthsPct)],
    ['Contribution now (before other costs)', formatCurrentContribution(row)],
    ['Monthly impact at your volume', formatMonthlyImpact(row)],
  ];
}

export function DishImpactCards({ rows }: DishImpactCardsProps) {
  return (
    <section aria-label="Dish comparison cards" className="grid gap-3 md:hidden">
      <h2 className="sr-only">Dish comparison</h2>
      {rows.map((row) => {
        const gotMoreExpensive =
          row.costDeltaCents !== null && row.costDeltaCents > 0n;

        return (
          <article key={row.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">
                <a href={hrefFor({ name: 'recipe', id: row.id })}>
                  {row.name}
                </a>
              </h3>
              {gotMoreExpensive && (
                <span className="shrink-0 text-sm text-amber-800">
                  ↑ Cost increased
                </span>
              )}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {metricRows(row).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="shrink-0 whitespace-nowrap text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <a
              className="mt-4 inline-block underline underline-offset-4"
              href={hrefFor({ name: 'simulator', id: row.id })}
            >
              Simulate
            </a>
          </article>
        );
      })}
    </section>
  );
}
