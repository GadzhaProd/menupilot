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
  const fraction = tenths < 0n ? -(tenths % 10n) : tenths % 10n;
  return `${tenths / 10n}.${fraction}%`;
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
  if (row.costDeltaMicro === null) return comparisonStatus(row) ?? 'n/a';
  const sign = row.costDeltaMicro > 0n ? '+' : '';
  return `${sign}${formatMoney(row.costDeltaMicro)}`;
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
