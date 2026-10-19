import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LocaleProvider, useFormatters, LOCALE_KEY } from '@/ui/i18n';
import { memoryStorage } from './helpers';

for (const locale of ['en', 'nl'] as const) {
  it(`formats unit costs in ${locale}, including pieces and unknown`, () => {
    const storage = memoryStorage({ [LOCALE_KEY]: locale });
    const { result } = renderHook(useFormatters, { wrapper: ({ children }) => <LocaleProvider storage={storage}>{children}</LocaleProvider> });
    const f = result.current;
    expect(typeof f.packPrice).toBe('function');
    expect(typeof f.prepCost).toBe('function');
    expect(f.packPrice(280, 250_000, 'g')).toBe(locale === 'en' ? '€11.20/kg' : '€\u00a011,20/kg');
    expect(f.packPrice(280, 250_000, 'ml')).toBe(locale === 'en' ? '€11.20/l' : '€\u00a011,20/l');
    expect(f.packPrice(280, 4000, 'pc')).toBe(locale === 'en' ? '€0.70/pc' : '€\u00a00,70/st.');
    expect(f.prepCost(1_800_000n, 1_000_000, 'g')).toBe(locale === 'en' ? '€1.80/kg' : '€\u00a01,80/kg');
    expect(f.prepCost(5000n, 1000, 'pc')).toBe(locale === 'en' ? '€0.01/pc' : '€\u00a00,01/st.');
    expect(f.prepCost(null, 1000, 'g')).toBe(locale === 'en' ? 'cost unknown' : 'kosten onbekend');
    expect(f.prepCost(0n, 1000, 'pc')).toBe(locale === 'en' ? '€0.00/pc' : '€\u00a00,00/st.');
  });
}
