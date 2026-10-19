import type { Locale } from './messages';
export const LOCALE_KEY = 'menupilot.ui.locale.v1';
export const browserLocale = (): Locale => typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en';
export const parseLocale = (value: string | null): Locale => value === 'en' || value === 'nl' ? value : browserLocale();
