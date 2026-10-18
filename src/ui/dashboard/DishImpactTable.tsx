import { formatEURFromCents } from '@/ui/domain/calc';
import type { DashboardDishRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';
import {
  DashboardTable,
  DashboardTableBody,
  DashboardTableCell,
  DashboardTableHead,
  DashboardTableHeader,
  DashboardTableRow,
} from './DashboardTable';
import {
  comparisonStatus,
  formatCostChange,
  formatCurrentCost,
  formatCurrentContribution,
  formatHistoricalCost,
  formatMoney,
  formatPoints,
  formatMonthlyImpact,
} from './format';

interface DishImpactTableProps {
  rows: readonly DashboardDishRow[];
  comparisonDate: string;
}

function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString();
}

export function DishImpactTable({ rows, comparisonDate }: DishImpactTableProps) {
  return (
    <div className="hidden md:block">
      <DashboardTable aria-label="Dish cost comparison">
        <DashboardTableHeader>
          <DashboardTableRow>
            <DashboardTableHead>Dish</DashboardTableHead>
            <DashboardTableHead>Menu price (incl. VAT)</DashboardTableHead>
            <DashboardTableHead>Price (excl. VAT)</DashboardTableHead>
            <DashboardTableHead>
              Recipe-based ingredient cost at {dateLabel(comparisonDate)} (excl. VAT)
            </DashboardTableHead>
            <DashboardTableHead>
              Recipe-based ingredient cost now (excl. VAT)
            </DashboardTableHead>
            <DashboardTableHead>Change (€)</DashboardTableHead>
            <DashboardTableHead>Food cost change (pts)</DashboardTableHead>
            <DashboardTableHead>
              Contribution now (before other costs)
            </DashboardTableHead>
            <DashboardTableHead>Monthly impact at your volume</DashboardTableHead>
            <DashboardTableHead>Action</DashboardTableHead>
          </DashboardTableRow>
        </DashboardTableHeader>
        <DashboardTableBody>
          {rows.map((row) => {
            const status = comparisonStatus(row);
            const gotMoreExpensive =
              row.costDeltaMicro !== null && row.costDeltaMicro > 0n;

            return (
              <DashboardTableRow key={row.id}>
                <DashboardTableCell className="font-medium">
                  <a href={hrefFor({ name: 'recipe', id: row.id })}>
                    {row.name}
                  </a>
                  {gotMoreExpensive && (
                    <span className="ml-2 text-amber-800">↑ Cost increased</span>
                  )}
                </DashboardTableCell>
                <DashboardTableCell>
                  {formatEURFromCents(row.menuPriceInclVatCents)}
                </DashboardTableCell>
                <DashboardTableCell>{formatMoney(row.priceExclVatMicro)}</DashboardTableCell>
                <DashboardTableCell>
                  {formatHistoricalCost(row)}
                </DashboardTableCell>
                <DashboardTableCell>
                  {formatCurrentCost(row)}
                </DashboardTableCell>
                <DashboardTableCell>{formatCostChange(row)}</DashboardTableCell>
                <DashboardTableCell>
                  {status ?? formatPoints(row.foodCostDeltaTenthsPct)}
                </DashboardTableCell>
                <DashboardTableCell>
                  {formatCurrentContribution(row)}
                </DashboardTableCell>
                <DashboardTableCell>{formatMonthlyImpact(row)}</DashboardTableCell>
                <DashboardTableCell>
                  <a href={hrefFor({ name: 'simulator', id: row.id })}>Simulate</a>
                </DashboardTableCell>
              </DashboardTableRow>
            );
          })}
        </DashboardTableBody>
      </DashboardTable>
    </div>
  );
}
