import { describe, expect, it } from 'vitest';
import { createTranslator, dictionaries, plural, type TranslationKey } from '@/ui/i18n';

describe('typed EN/NL messages', () => {
  it('has parity of stable keys, placeholders and nonempty messages', () => {
    expect(Object.keys(dictionaries.nl).sort()).toEqual(Object.keys(dictionaries.en).sort());
    const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(dictionaries.en) as TranslationKey[]) {
      expect(key).toMatch(/^[a-z]+\.[A-Za-z.]+$/);
      expect(dictionaries.nl[key].trim().length).toBeGreaterThan(0);
      expect(dictionaries.en[key].trim().length).toBeGreaterThan(0);
      expect(parameters(dictionaries.nl[key])).toEqual(parameters(dictionaries.en[key]));
    }
  });
  it('interpolates user data literally and pluralises whole messages', () => {
    const t = createTranslator('nl');
    expect(t('count.dishes.other', { count: 3 })).toBe('3 gerechten');
    expect(t('count.dishes.other', { count: '<b>3</b>' })).toBe('<b>3</b> gerechten');
    expect(plural('en', 'count.dishes', 1)).toBe('1 dish');
    expect(plural('nl', 'count.preps', 0)).toBe('0 basisrecepten');
    expect(plural('nl', 'count.preps', 1)).toBe('1 basisrecept');
    expect(() => plural('nl', 'count.preps', -1)).toThrow();
    // @ts-expect-error required count is checked at compile time, too
    expect(() => t('count.dishes.other')).toThrow(/Missing translation parameter/);
  });
});
