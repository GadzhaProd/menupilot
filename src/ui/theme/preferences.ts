export const THEME_KEY = 'menupilot.ui.theme.v1';
export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';
export const parseTheme = (value: string | null): ThemePreference => value === 'light' || value === 'dark' ? value : 'system';
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';
