import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import type { StorageLike } from '@/ui/domain/store';
import { usePersistentChoice } from '@/lib/use-persistent-choice';
import { createTranslator, plural, type Locale, type PluralKey, type PluralParams, type Translate } from './messages';
import { createRichTranslator, type RichTranslate } from './rich';
import { LOCALE_KEY, parseLocale } from './preferences';
interface LocaleContextValue {
  locale: Locale; setLocale(locale: Locale): void; t: Translate; tRich: RichTranslate;
  plural<K extends PluralKey>(key: K, count: number, params?: PluralParams<K>): string; storageError: boolean;
}
// Isolated shared components (and their tests) have a predictable EN default.
const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', setLocale: () => {}, t: createTranslator('en'), tRich: createRichTranslator('en'), plural: (key, count, params) => plural('en', key, count, params), storageError: false });
export function LocaleProvider({ storage, children }: { storage: StorageLike | null; children: ReactNode }) {
  const { value: locale, setValue: setLocale, storageError } = usePersistentChoice(storage, LOCALE_KEY, parseLocale);
  useLayoutEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, storageError, t: createTranslator(locale), tRich: createRichTranslator(locale), plural: <K extends PluralKey>(key: K, count: number, params?: PluralParams<K>) => plural(locale, key, count, params) }), [locale, setLocale, storageError]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
