import { useFormatters, useLocale } from '@/ui/i18n';
import type { DashboardDishRow } from '@/ui/domain/dashboard';

/** Localised presentation of existing calculation results; no arithmetic. */
export function useDishFigures() {
  const f = useFormatters();
  const { t } = useLocale();
  return (row: DashboardDishRow) => {
    const status = row.status === 'no-price-on-date' ? t('dashboard.noPrice')
      : row.status === 'error' ? t('common.notApplicable') : t('common.costUnknown');
    return {
      menu: f.money(row.menuPriceInclVatCents),
      net: row.priceExclVatMicro === null ? '—' : f.microMoney(row.priceExclVatMicro),
      before: row.comparisonCostMicro === null ? status : f.microMoney(row.comparisonCostMicro),
      now: row.currentCostMicro === null ? status : f.microMoney(row.currentCostMicro),
      change: row.costDeltaCents === null ? status : `${row.costDeltaCents > 0n ? '+' : ''}${f.money(row.costDeltaCents)}`,
      points: row.status === 'ready' ? f.points(row.foodCostDeltaTenthsPct) : status,
      contribution: row.currentContributionMicro === null ? status : f.microMoney(row.currentContributionMicro),
      monthly: row.monthlyVolume === null ? '—' : row.monthlyImpactCents === null ? status
        : `${row.monthlyImpactCents > 0n ? '+' : ''}${f.money(row.monthlyImpactCents)}`,
    };
  };
}
export const costTone = (value: bigint | null) => value === null || value === 0n ? '' : value > 0n ? 'text-negative' : 'text-positive';
export const contributionTone = (value: bigint | null) => value === null || value === 0n ? '' : value > 0n ? 'text-positive' : 'text-negative';
