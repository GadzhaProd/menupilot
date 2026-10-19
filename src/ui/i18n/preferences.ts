import { normalizeLocale } from '@/ui/domain/calc';
import type { Locale } from './messages';
export const LOCALE_KEY = 'menupilot.ui.locale.v1';
export const browserLocale = (): Locale => normalizeLocale(typeof navigator === 'undefined' ? 'en' : navigator.language);
export const parseLocale = (value: string | null): Locale => value === 'en' || value === 'nl' ? value : browserLocale();
