import { useLocale } from '@/ui/i18n';
import { CircleHelpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrefFor } from '@/ui/router/routes';
import type { HelpLang } from './types';
import type { HelpSectionId } from './types';

/** Kept for the guide-language selector; screen link labels follow the interface locale. */
export const HELP_LINK_LABEL: Record<HelpLang, string> = {
  en: 'Help for this page',
  ru: 'Справка по этой странице (Help)',
};

/** Small link on every screen that opens the guide at the matching section. */
export function HelpLink({ section, className }: { section: HelpSectionId; className?: string }) {
  const { t } = useLocale();
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
      {t('help.contextLink')}
    </a>
  );
}
