import { useId } from 'react';
import { Select } from '@/components/ui/select';
import { useLocale } from '@/ui/i18n';
import { useTheme } from './ThemeProvider';
import { parseTheme } from './preferences';
export function ThemeSelect() {
  const id = useId(); const { t } = useLocale(); const { preference, setPreference } = useTheme();
  return <div className="theme-select"><label htmlFor={id}>{t('theme.label')}</label><Select id={id} value={preference} onChange={(event) => setPreference(parseTheme(event.target.value))}>
    <option value="system">{t('theme.system')}</option><option value="light">{t('theme.light')}</option><option value="dark">{t('theme.dark')}</option>
  </Select></div>;
}
