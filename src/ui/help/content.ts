import { contentEn, localContentEn } from './content.en';
import { contentNl, localContentNl } from './content.nl';
import { contentRu, localContentRu } from './content.ru';
import type { HelpDocument, HelpLang } from './types';

export const HELP_CONTENT: Record<HelpLang, HelpDocument> = { en: contentEn, nl: contentNl, ru: contentRu };

export const LOCAL_HELP_CONTENT: Record<HelpLang, HelpDocument> = { en: localContentEn, nl: localContentNl, ru: localContentRu };
