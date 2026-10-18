/** How simulator figures are written. Display only: every number comes from src/calc. */
import { BadgeDelta } from '@/components/ui/badge-delta';
import { formatEURFromCents } from '@/ui/domain/calc';
import type { SimulateResult } from '@/ui/domain/types';
import { formatTenthsPct } from '@/ui/forms/numbers';

export const DASH = '—';

/** "€12.00", or "—" when the figure is not known. */
export const euro = (cents: bigint | number | null) => (cents === null ? DASH : formatEURFromCents(cents));

export const signedEuro = (cents: bigint) => (cents > 0n ? `+${formatEURFromCents(cents)}` : formatEURFromCents(cents));

export const signedPoints = (tenths: bigint) => `${tenths > 0n ? '+' : ''}${formatTenthsPct(tenths).replace('%', '')} pp`;

/** Ingredient cost per portion: unknown is never shown as zero. */
export const costText = (result: SimulateResult) => (result.ingredientCostCents === null ? 'cost unknown' : formatEURFromCents(result.ingredientCostCents));

/** Food cost % and margin %: "n/a" when the price is zero, "—" when the cost is unknown. */
export function percentText(result: SimulateResult, value: bigint | null) {
  if (value !== null) return formatTenthsPct(value);
  return result.status === 'price-zero' ? 'n/a' : DASH;
}

type Good = 'higher' | 'lower';

/**
 * A change against Baseline as a small badge. `better` says which direction is good news:
 * a higher contribution is, a higher cost is not. Unknown changes show a dash.
 */
export function Delta({ value, format, better }: { value: bigint | null; format: (value: bigint) => string; better: Good }) {
  if (value === null) return <span className="text-muted-foreground" aria-label="no comparison">{DASH}</span>;
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
