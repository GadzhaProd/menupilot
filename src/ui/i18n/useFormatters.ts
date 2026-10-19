import type { UnitPrice } from '@/ui/domain/types';
import { useMemo } from 'react';
import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale, formatPointsLocale, formatDateLocale, packUnitPriceCents, prepUnitCostCents } from '@/ui/domain/calc';
import { useLocale } from './LocaleProvider';
/** Explicit locale-bound formatters: no global mutable locale and no DOM translation. */
export function useFormatters() {
  const { locale, t } = useLocale();
  return useMemo(() => {
    const unitPrice = (value: UnitPrice | null): string => value === null
      ? t('common.costUnknown')
      : `${formatEURFromCentsLocale(value.cents, locale)}/${t(`units.${value.per}`)}`;
    const integers = new Intl.NumberFormat(locale);
    return {
      integer: (value: number | bigint) => {
        if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new RangeError('Expected a safe integer.');
        return integers.format(value);
      },
      money: (cents: bigint | number) => formatEURFromCentsLocale(cents, locale),
      microMoney: (micro: bigint) => formatEURFromMicroLocale(micro, locale),
      percent: (tenths: bigint | null) => formatPercentTenthsLocale(tenths, locale),
      points: (tenths: bigint | null) => formatPointsLocale(tenths, locale),
      packPrice: (packCents: number, packSizeMilli: number, unit: string) => unitPrice(packUnitPriceCents(packCents, packSizeMilli, unit)),
      prepCost: (batchMicro: bigint | null, outputMilli: number, unit: string) => unitPrice(prepUnitCostCents(batchMicro, outputMilli, unit)),
      date: (iso: string) => formatDateLocale(iso, locale),
    };
  }, [locale, t]);
}
