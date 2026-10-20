import { contentEn } from './content.en';
import { contentNl } from './content.nl';
import { contentRu } from './content.ru';
import type { HelpDocument, HelpLang } from './types';

export const HELP_CONTENT: Record<HelpLang, HelpDocument> = { en: contentEn, nl: contentNl, ru: contentRu };
