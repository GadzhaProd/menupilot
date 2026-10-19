import html from '../../index.html?raw';
import { afterEach, expect, it, vi } from 'vitest';
import { LOCALE_KEY, parseLocale } from '@/ui/i18n/preferences';
import { THEME_KEY, COLOR_SCHEME_QUERY, parseTheme } from '@/ui/theme/preferences';

const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!source) throw new Error('Pre-paint bootstrap script is missing');
const bootstrap = new Function('localStorage', 'matchMedia', 'navigator', 'document', source);
afterEach(() => vi.restoreAllMocks());

it('the pre-paint script agrees with runtime preference parsers for persisted and default choices', () => {
  for (const browserLanguage of ['en-US', 'nl-BE', 'NL', 'de-DE']) {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLanguage);
    for (const theme of [null, 'system', 'light', 'dark', 'invalid']) {
      for (const locale of [null, 'en', 'nl', 'invalid']) {
        for (const dark of [false, true]) {
          const reads: string[] = [];
          const storage = { getItem(key: string) { reads.push(key); return key === THEME_KEY ? theme : key === LOCALE_KEY ? locale : null; } };
          bootstrap(storage, (query: string) => { expect(query).toBe(COLOR_SCHEME_QUERY); return { matches: dark }; }, navigator, document);
          const parsed = parseTheme(theme);
          const expectedTheme = parsed === 'system' ? dark ? 'dark' : 'light' : parsed;
          expect(document.documentElement.dataset.theme).toBe(expectedTheme);
          expect(document.documentElement.style.colorScheme).toBe(expectedTheme);
          expect(document.documentElement.lang).toBe(parseLocale(locale));
          expect(reads).toEqual([THEME_KEY, LOCALE_KEY]);
        }
      }
    }
  }
});
it('blocked storage still boots with system theme and browser language', () => {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('nl-NL');
  bootstrap({ getItem() { throw new Error('storage blocked'); } }, () => ({ matches: true }), navigator, document);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.lang).toBe(parseLocale(null));
});
