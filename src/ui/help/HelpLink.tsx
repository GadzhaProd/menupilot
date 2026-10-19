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
  return (
    <a
      href={hrefFor({ name: 'help', section })}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-sm text-primary underline underline-offset-4',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <CircleHelpIcon aria-hidden="true" className="size-4" />
      {HELP_LINK_LABEL[readHelpLanguage()]}
    </a>
  );
}
