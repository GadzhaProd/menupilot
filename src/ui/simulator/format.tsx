import { useFormatters, useLocale } from '@/ui/i18n';
/** How simulator figures are written. Display only: every number comes from src/calc. */
import { BadgeDelta } from '@/components/ui/badge-delta';
import type { SimulateResult } from '@/ui/domain/types';

export const DASH = '—';

type Good = 'higher' | 'lower';

/**
 * A change against Baseline as a small badge. `better` says which direction is good news:
 * a higher contribution is, a higher cost is not. Unknown changes show a dash.
 */
export function Delta({ value, format, better }: { value: bigint | null; format: (value: bigint) => string; better: Good }) {
  const { t } = useLocale();
  if (value === null) return <span className="text-muted-foreground" aria-label={t('simulator.noComparison')}>{DASH}</span>;
  if (value === 0n) return <BadgeDelta deltaType="neutral" value={format(0n)} />;
  const up = value > 0n;
  return (
    <BadgeDelta
      deltaType={up ? 'increase' : 'decrease'}
      tone={up === (better === 'higher') ? 'good' : 'bad'}
      value={format(value)}
    />
  );
}

/** Locale-bound display helpers for nullable calc results. */
export function useSimulatorFormat() {
  const f = useFormatters();
  const { t } = useLocale();
  return {
    euro: (cents: bigint | number | null) => cents === null ? DASH : f.money(cents),
    signedEuro: (cents: bigint) => `${cents > 0n ? '+' : ''}${f.money(cents)}`,
    signedPoints: f.points,
    costText: (result: SimulateResult) => result.ingredientCostCents === null ? t('common.costUnknown') : f.money(result.ingredientCostCents),
    percentText: (result: SimulateResult, value: bigint | null) => value !== null ? f.percent(value) : result.status === 'price-zero' ? t('common.notApplicable') : DASH,
  };
}
