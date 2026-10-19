import { contentEn } from './content.en';
import { contentRu } from './content.ru';
import type { HelpDocument, HelpLang } from './types';

export const HELP_CONTENT: Record<HelpLang, HelpDocument> = { en: contentEn, ru: contentRu };
