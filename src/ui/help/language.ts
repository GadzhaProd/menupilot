import type { HelpLang } from './types';

/** Where the guide remembers the language. Not the data document: language is not business data. */
export const HELP_LANGUAGE_KEY = 'menupilot:help-language';

interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Browser language "ru", "ru-RU" and so on give Russian; everything else gives English. */
export function languageFromBrowser(browserLanguage: string | undefined): HelpLang {
  return typeof browserLanguage === 'string' && /^ru(?:[-_]|$)/i.test(browserLanguage) ? 'ru' : 'en';
}

/** The browser's storage, or null when it is blocked (private mode, strict settings). */
function browserStorage(): LanguageStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The remembered language, or the browser's language when nothing was chosen yet. */
export function readHelpLanguage(storage: LanguageStorage | null = browserStorage()): HelpLang {
  try {
    const saved = storage?.getItem(HELP_LANGUAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    // Storage is not readable: fall back to the browser language.
  }
  return languageFromBrowser(typeof navigator === 'undefined' ? undefined : navigator.language);
}

/** Remember the choice. Failing to remember is harmless: the guide still works. */
export function saveHelpLanguage(lang: HelpLang, storage: LanguageStorage | null = browserStorage()): void {
  try {
    storage?.setItem(HELP_LANGUAGE_KEY, lang);
  } catch {
    // Not remembered; the choice still applies until the page is closed.
  }
}
