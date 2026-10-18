import { formatEURFromCents } from '@/ui/domain/calc';
import type { DashboardDishRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface DishImpactTableProps {
  rows: readonly DashboardDishRow[];
  comparisonDate: string;
}

const HEAD = 'h-auto whitespace-normal py-2 align-bottom';

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}-${month}-${day} UTC`;
}

function DishRow({ row }: { row: DashboardDishRow }) {
  const status = comparisonStatus(row);
  const gotMoreExpensive = row.costDeltaCents !== null
    && row.costDeltaCents > 0n;

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-normal">
        <a className="underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'recipe', id: row.id })}>{row.name}</a>
        {gotMoreExpensive && (
          <span className="ml-2 whitespace-nowrap text-amber-800">↑ Cost increased</span>
        )}
      </TableCell>
      <TableCell>{formatEURFromCents(row.menuPriceInclVatCents)}</TableCell>
      <TableCell>{formatMoney(row.priceExclVatMicro)}</TableCell>
      <TableCell>{formatHistoricalCost(row)}</TableCell>
      <TableCell>{formatCurrentCost(row)}</TableCell>
      <TableCell>{formatCostChange(row)}</TableCell>
      <TableCell>{status ?? formatPoints(row.foodCostDeltaTenthsPct)}</TableCell>
      <TableCell>{formatCurrentContribution(row)}</TableCell>
      <TableCell>{formatMonthlyImpact(row)}</TableCell>
      <TableCell>
        <a className="underline-offset-4 hover:underline focus-visible:underline" href={hrefFor({ name: 'simulator', id: row.id })}>Simulate</a>
      </TableCell>
    </TableRow>
  );
}

export function DishImpactTable({ rows, comparisonDate }: DishImpactTableProps) {
  return (
    <div className="hidden md:block">
      <Table aria-label="Dish cost comparison">
        <TableHeader className="border-b">
          <TableRow>
            <TableHead className={HEAD}>Dish</TableHead>
            <TableHead className={HEAD}>Menu price (incl. VAT)</TableHead>
            <TableHead className={HEAD}>Price (excl. VAT)</TableHead>
            <TableHead className={HEAD}>
              Recipe-based ingredient cost at {dateLabel(comparisonDate)}
              {' '}(excl. VAT)
            </TableHead>
            <TableHead className={HEAD}>
              Recipe-based ingredient cost now (excl. VAT)
            </TableHead>
            <TableHead className={HEAD}>Change (€)</TableHead>
            <TableHead className={HEAD}>Food cost change (pts)</TableHead>
            <TableHead className={HEAD}>Contribution now (before other costs)</TableHead>
            <TableHead className={HEAD}>Monthly impact at your volume</TableHead>
            <TableHead className={HEAD}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => <DishRow key={row.id} row={row} />)}
        </TableBody>
      </Table>
    </div>
  );
}
