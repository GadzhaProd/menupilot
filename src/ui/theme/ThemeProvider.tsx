import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import type { StorageLike } from '@/ui/domain/store';
import { usePersistentChoice } from '@/lib/use-persistent-choice';
import { COLOR_SCHEME_QUERY, parseTheme, THEME_KEY, type EffectiveTheme, type ThemePreference } from './preferences';
interface ThemeContextValue { preference: ThemePreference; theme: EffectiveTheme; setPreference(value: ThemePreference): void; storageError: boolean }
const ThemeContext = createContext<ThemeContextValue>({ preference: 'system', theme: 'light', setPreference: () => {}, storageError: false });
export function ThemeProvider({ storage, children }: { storage: StorageLike | null; children: ReactNode }) {
  const { value: preference, setValue: setPreference, storageError } = usePersistentChoice(storage, THEME_KEY, parseTheme);
  const [dark, setDark] = useState(() => window.matchMedia?.(COLOR_SCHEME_QUERY).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(COLOR_SCHEME_QUERY);
    if (!media) return;
    const change = () => setDark(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const theme = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return <ThemeContext.Provider value={{ preference, theme, setPreference, storageError }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
