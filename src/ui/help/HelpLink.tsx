import { useLocale } from '@/ui/i18n';
import { CircleHelpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrefFor } from '@/ui/router/routes';
import { readHelpLanguage } from './language';
import type { HelpLang } from './types';

/** Kept here (not in the guide text) so the screens do not pull the whole guide into the first download. */
export const HELP_LINK_LABEL: Record<HelpLang, string> = {
  en: 'Help for this page',
  ru: 'Справка по этой странице (Help)',
};
import type { HelpSectionId } from './types';

/** Small link on every screen that opens the guide at the matching section. */
export function HelpLink({ section, className }: { section: HelpSectionId; className?: string }) {
  const { locale, t } = useLocale();
  return (
    <a
      href={hrefFor({ name: 'help', section })}
      className={cn(
        'inline-flex min-h-12 items-center gap-1.5 rounded-md text-sm text-accent-foreground underline underline-offset-4',
        'focus-visible:outline-3 focus-visible:outline-ring',
        className,
      )}
    >
      <CircleHelpIcon aria-hidden="true" className="size-4" />
      {locale === 'nl' || readHelpLanguage() === 'en' ? t('help.contextLink') : HELP_LINK_LABEL.ru}
    </a>
  );
}
