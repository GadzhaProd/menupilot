import { formatEURFromCents, formatEURFromMicro } from '@/ui/domain/calc';
import type { DashboardDishRow } from '@/ui/domain/dashboard';

export function formatMoney(microEuros: bigint | null): string {
  return microEuros === null ? '—' : formatEURFromMicro(microEuros);
}

export function formatCents(cents: bigint | null): string {
  return cents === null ? '—' : formatEURFromCents(cents);
}

export function formatPercentTenths(tenths: bigint | null): string {
  if (tenths === null) return 'n/a';
  const sign = tenths < 0n ? '-' : '';
  const absolute = tenths < 0n ? -tenths : tenths;
  return `${sign}${absolute / 10n}.${absolute % 10n}%`;
}

export function formatPoints(tenths: bigint | null): string {
  if (tenths === null) return 'n/a';
  const sign = tenths > 0n ? '+' : '';
  return `${sign}${formatPercentTenths(tenths).replace('%', '')} pts`;
}

export function comparisonStatus(row: DashboardDishRow): string | null {
  if (row.status === 'no-price-on-date') return 'no price on this date';
  if (row.status === 'cost-unknown') return 'cost unknown';
  if (row.status === 'error') return 'n/a';
  return null;
}

export function formatCostChange(row: DashboardDishRow): string {
  if (row.costDeltaCents === null) return comparisonStatus(row) ?? 'n/a';
  const sign = row.costDeltaCents > 0n ? '+' : '';
  return `${sign}${formatCents(row.costDeltaCents)}`;
}

export function formatHistoricalCost(row: DashboardDishRow): string {
  if (row.comparisonCostMicro === null) {
    return comparisonStatus(row) ?? 'cost unknown';
  }
  return formatMoney(row.comparisonCostMicro);
}

export function formatCurrentCost(row: DashboardDishRow): string {
  if (row.currentCostMicro !== null) return formatMoney(row.currentCostMicro);
  if (row.status === 'error') return 'n/a';
  return 'cost unknown';
}

export function formatCurrentContribution(row: DashboardDishRow): string {
  if (row.currentContributionMicro !== null) {
    return formatMoney(row.currentContributionMicro);
  }
  return row.currentCostMicro === null ? formatCurrentCost(row) : 'n/a';
}

export function formatMonthlyImpact(row: DashboardDishRow): string {
  if (row.monthlyVolume === null) return '—';
  if (row.monthlyImpactCents === null) {
    return comparisonStatus(row) ?? 'cost unknown';
  }
  return formatCents(row.monthlyImpactCents);
}
