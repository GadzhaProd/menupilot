import type { Locale } from '@/ui/i18n/messages';
import type { HelpLang } from './types';

/** Where the guide remembers a language the owner chose. Not the data document: language is not business data. */
export const HELP_LANGUAGE_KEY = 'menupilot:help-language';

interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The guide follows the language of the screen. Russian is only ever chosen by hand. */
export function languageFromInterface(locale: Locale): HelpLang {
  return locale === 'nl' ? 'nl' : 'en';
}

/** The browser's storage, or null when it is blocked (private mode, strict settings). */
function browserStorage(): LanguageStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The language the owner chose in the guide, or null when nothing (valid) was chosen yet. */
export function readHelpLanguage(storage: LanguageStorage | null = browserStorage()): HelpLang | null {
  try {
    const saved = storage?.getItem(HELP_LANGUAGE_KEY);
    if (saved === 'en' || saved === 'nl' || saved === 'ru') return saved;
  } catch {
    // Storage is not readable: nothing was chosen.
  }
  return null;
}

/** Remember the choice. Failing to remember is harmless: the guide still works. */
export function saveHelpLanguage(lang: HelpLang, storage: LanguageStorage | null = browserStorage()): void {
  try {
    storage?.setItem(HELP_LANGUAGE_KEY, lang);
  } catch {
    // Not remembered; the choice still applies until the page is closed.
  }
}
