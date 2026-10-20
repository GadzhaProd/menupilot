/** Shape of the built-in guide. Both languages use these types, so they cannot drift apart. */

export type HelpLang = 'en' | 'nl' | 'ru';

/** Which set of screenshots a guide language uses: the Russian guide shows the English screen. */
export type HelpImageSet = 'en' | 'nl';
export const HELP_IMAGE_SET: Record<HelpLang, HelpImageSet> = { en: 'en', nl: 'nl', ru: 'en' };

export const HELP_SECTION_IDS = [
  'how-to-use',
  'about',
  'glossary',
  'first-start',
  'appearance',
  'ingredients',
  'preps',
  'dishes',
  'dashboard',
  'simulator',
  'data',
  'troubleshooting',
] as const;

export type HelpSectionId = (typeof HELP_SECTION_IDS)[number];

/** The number a section has in the contents (1-based), so texts never hard-code "section 10". */
export const sectionNumber = (id: HelpSectionId): number => HELP_SECTION_IDS.indexOf(id) + 1;

/** A screenshot in public/help; the file name and size live in images.ts. */
export type HelpImageId =
  | 'menu'
  | 'theme-language'
  | 'help-toolbar'
  | 'data-page'
  | 'data-empty-dialog'
  | 'data-reset-dialog'
  | 'ingredients-list'
  | 'ingredient-add'
  | 'ingredient-price'
  | 'ingredient-history'
  | 'ingredient-rename'
  | 'ingredient-delete'
  | 'ingredient-in-use'
  | 'prep-form'
  | 'prep-lines'
  | 'prep-cost'
  | 'dish-form'
  | 'dish-lines'
  | 'dish-cost'
  | 'dashboard-cards'
  | 'dashboard-picker'
  | 'dashboard-table'
  | 'dashboard-preps'
  | 'dashboard-summary'
  | 'simulator-picker'
  | 'simulator-baseline'
  | 'simulator-scenario'
  | 'simulator-qty'
  | 'simulator-prices'
  | 'simulator-compare'
  | 'simulator-stale';

/** Inline text: plain, a button or field name as shown on screen (bold), or a link to another section. */
export type RichPart = string | { readonly b: string } | { readonly to: HelpSectionId; readonly text: string };
export type Rich = string | readonly RichPart[];

/** Mark a button, field or menu name exactly as it appears on screen. */
export const b = (text: string): RichPart => ({ b: text });
/** Link to another section of the guide. */
export const to = (section: HelpSectionId, text: string): RichPart => ({ to: section, text });

export interface HelpImage {
  readonly id: HelpImageId;
  /** What the picture shows, in the language of the page. */
  readonly alt: string;
  /** One line under the picture; points at the part to look at. */
  readonly caption?: string;
}

/** One action = one numbered step. */
export interface HelpStep {
  readonly text: Rich;
  /** What the person should see after the step. */
  readonly result?: Rich;
  readonly image?: HelpImage;
}

export interface HelpTerm {
  readonly term: string;
  readonly meaning: Rich;
  /** An everyday example (a burger, a pack of mince). */
  readonly example?: Rich;
}

/** A message the app shows. `message` is the text on screen: English for the English and Russian guides, Dutch for the Dutch one. */
export interface HelpMessage {
  readonly message: string;
  readonly meaning: Rich;
}

export type HelpBlock =
  | { readonly kind: 'p'; readonly text: Rich }
  | { readonly kind: 'h3'; readonly text: string }
  | { readonly kind: 'steps'; readonly title: string; readonly steps: readonly HelpStep[] }
  | { readonly kind: 'note'; readonly tone: 'safe' | 'important'; readonly title: string; readonly text: Rich }
  | { readonly kind: 'image'; readonly image: HelpImage }
  | { readonly kind: 'list'; readonly items: readonly Rich[] }
  | { readonly kind: 'terms'; readonly items: readonly HelpTerm[] }
  | { readonly kind: 'messages'; readonly items: readonly HelpMessage[] };

export interface HelpSection {
  readonly id: HelpSectionId;
  readonly title: string;
  readonly blocks: readonly HelpBlock[];
}

export interface HelpDocument {
  readonly lang: HelpLang;
  readonly title: string;
  readonly subtitle: string;
  /** Words used by the page itself (buttons, labels). */
  readonly ui: {
    readonly languageLabel: string;
    readonly print: string;
    readonly contents: string;
    readonly toTop: string;
    readonly stepsDone: string;
    readonly openLarger: string;
    readonly backToContents: string;
    readonly messageHeader: string;
    readonly meaningHeader: string;
    readonly contextLink: string;
  };
  readonly sections: readonly HelpSection[];
}
