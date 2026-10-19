import { useMemo } from 'react';
import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale, formatPointsLocale, formatDateLocale } from '@/ui/domain/calc';
import { useLocale } from './LocaleProvider';
/** Explicit locale-bound formatters: no global mutable locale and no DOM translation. */
export function useFormatters() {
  const { locale } = useLocale();
  return useMemo(() => ({
    money: (cents: bigint | number) => formatEURFromCentsLocale(cents, locale),
    microMoney: (micro: bigint) => formatEURFromMicroLocale(micro, locale),
    percent: (tenths: bigint | null) => formatPercentTenthsLocale(tenths, locale),
    points: (tenths: bigint | null) => formatPointsLocale(tenths, locale),
    date: (iso: string) => formatDateLocale(iso, locale),
  }), [locale]);
}
