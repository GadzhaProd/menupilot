import en from '../../../data/demo.json';
import nl from '../../../data/demo.nl.json';
import type { Locale } from '@/ui/i18n';
/** Only explicitly loading/resetting the fictional demo selects translated names. */
export const demoForLocale = (locale: Locale): unknown => locale === 'nl' ? nl : en;
export const isBundledDemo = (demo: unknown) => demo === en;
