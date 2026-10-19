import { createContext, useContext, type MouseEvent } from 'react';
import { hrefFor } from '@/ui/router/routes';
import type { HelpSectionId } from './types';

/**
 * Opens a section (or the start of the guide). The guide provides it, so a link to the section
 * that is already in the address still scrolls there.
 */
export const HelpNavContext = createContext<(section: HelpSectionId | null) => void>(() => {});

/** Click handler for a link to a section: plain left clicks are handled here, others keep default behaviour. */
export function useSectionLink(section: HelpSectionId | null) {
  const open = useContext(HelpNavContext);
  return {
    href: hrefFor({ name: 'help', section }),
    onClick(event: MouseEvent<HTMLAnchorElement>) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(section);
    },
  };
}
