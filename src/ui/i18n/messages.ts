import { en, type TranslationKey } from './en';
import { nl } from './nl';
export type Locale = 'en' | 'nl';
export type { TranslationKey };
export const dictionaries = { en, nl };
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Placeholders<Rest> : never;
export type MessageParams<K extends TranslationKey> = Record<Placeholders<(typeof en)[K]>, string | number | bigint>;
type Args<K extends TranslationKey> = [Placeholders<(typeof en)[K]>] extends [never] ? [] : [params: MessageParams<K>];
export type Translate = <K extends TranslationKey>(key: K, ...args: Args<K>) => string;
export function createTranslator(locale: Locale): Translate {
  return <K extends TranslationKey>(key: K, ...args: Args<K>): string => {
    const params = args[0] as Record<string, string | number | bigint> | undefined;
    return dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => {
      if (params?.[name] === undefined) throw new Error(`Missing translation parameter: ${key}.${name}`);
      return String(params[name]);
    });
  };
}
export type PluralKey = { [K in TranslationKey]: K extends `${infer Base}.one` ? `${Base}.other` extends TranslationKey ? Base : never : never }[TranslationKey];
const rules = { en: new Intl.PluralRules('en'), nl: new Intl.PluralRules('nl') };
/** EN/NL cardinal plurals: use whole messages, with count available as a parameter. */
export function plural(locale: Locale, key: PluralKey, count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Count must be a non-negative safe integer.');
  const category = rules[locale].select(count) === 'one' ? 'one' : 'other';
  return createTranslator(locale)(`${key}.${category}`, { count });
}
