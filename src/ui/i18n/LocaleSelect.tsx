import { Button } from '@/components/ui/button';
import { useLocale } from './LocaleProvider';
export function LocaleSelect() {
  const { locale, setLocale, t } = useLocale();
  return <div role="group" aria-label={t('locale.label')} className="locale-select">
    <Button variant="ghost" size="sm" className="min-w-12" aria-label="EN – English" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</Button>
    <span aria-hidden="true">|</span>
    <Button variant="ghost" size="sm" className="min-w-12" aria-label="NL – Nederlands" lang="nl" aria-pressed={locale === 'nl'} onClick={() => setLocale('nl')}>NL</Button>
  </div>;
}
