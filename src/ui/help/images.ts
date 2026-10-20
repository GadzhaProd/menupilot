import type { HelpImageId, HelpImageSet } from './types';

export interface HelpImageFile {
  /** File name inside public/help/<set>. */
  readonly file: string;
  /** Size on screen in CSS pixels (the pictures are saved at up to 1.5 times this, so they stay sharp when zoomed). */
  readonly width: number;
  readonly height: number;
}

/**
 * Real screenshots of the demo cafe in the light theme, cropped to the part of the screen a step talks about.
 * `en` is the English screen (used by the English and Russian guides), `nl` the Dutch screen with the Dutch demo data.
 * The files live in public/help/<set> and are loaded lazily.
 */
export const HELP_IMAGES: Record<HelpImageSet, Record<HelpImageId, HelpImageFile>> = {
  en: {
    'dashboard-cards': { file: 'dashboard-cards.jpg', width: 1232, height: 343 },
    'dashboard-picker': { file: 'dashboard-picker.jpg', width: 1232, height: 98 },
    'dashboard-preps': { file: 'dashboard-preps.jpg', width: 1232, height: 299 },
    'dashboard-summary': { file: 'dashboard-summary.jpg', width: 1232, height: 158 },
    'dashboard-table': { file: 'dashboard-table.jpg', width: 1232, height: 563 },
    'data-empty-dialog': { file: 'data-empty-dialog.jpg', width: 524, height: 217 },
    'data-page': { file: 'data-page.jpg', width: 1026, height: 1009 },
    'data-reset-dialog': { file: 'data-reset-dialog.jpg', width: 524, height: 194 },
    'dish-cost': { file: 'dish-cost.jpg', width: 1232, height: 451 },
    'dish-form': { file: 'dish-form.jpg', width: 1232, height: 452 },
    'dish-lines': { file: 'dish-lines.jpg', width: 1232, height: 693 },
    'help-toolbar': { file: 'help-toolbar.jpg', width: 647, height: 68 },
    'ingredient-add': { file: 'ingredient-add.jpg', width: 524, height: 561 },
    'ingredient-delete': { file: 'ingredient-delete.jpg', width: 524, height: 194 },
    'ingredient-history': { file: 'ingredient-history.jpg', width: 684, height: 381 },
    'ingredient-in-use': { file: 'ingredient-in-use.jpg', width: 524, height: 325 },
    'ingredient-price': { file: 'ingredient-price.jpg', width: 524, height: 446 },
    'ingredient-rename': { file: 'ingredient-rename.jpg', width: 524, height: 263 },
    'ingredients-list': { file: 'ingredients-list.jpg', width: 1232, height: 775 },
    menu: { file: 'menu.jpg', width: 1280, height: 81 },
    'prep-cost': { file: 'prep-cost.jpg', width: 1232, height: 271 },
    'prep-form': { file: 'prep-form.jpg', width: 1232, height: 334 },
    'prep-lines': { file: 'prep-lines.jpg', width: 1232, height: 533 },
    'simulator-baseline': { file: 'simulator-baseline.jpg', width: 1232, height: 192 },
    'simulator-compare': { file: 'simulator-compare.jpg', width: 928, height: 1048 },
    'simulator-picker': { file: 'simulator-picker.jpg', width: 821, height: 324 },
    'simulator-prices': { file: 'simulator-prices.jpg', width: 260, height: 510 },
    'simulator-qty': { file: 'simulator-qty.jpg', width: 260, height: 420 },
    'simulator-scenario': { file: 'simulator-scenario.jpg', width: 296, height: 1055 },
    'simulator-stale': { file: 'simulator-stale.jpg', width: 258, height: 330 },
    'theme-language': { file: 'theme-language.jpg', width: 308, height: 76 },
  },
  nl: {
    'dashboard-cards': { file: 'dashboard-cards.jpg', width: 1232, height: 343 },
    'dashboard-picker': { file: 'dashboard-picker.jpg', width: 1232, height: 98 },
    'dashboard-preps': { file: 'dashboard-preps.jpg', width: 1232, height: 299 },
    'dashboard-summary': { file: 'dashboard-summary.jpg', width: 1232, height: 181 },
    'dashboard-table': { file: 'dashboard-table.jpg', width: 1232, height: 563 },
    'data-empty-dialog': { file: 'data-empty-dialog.jpg', width: 524, height: 217 },
    'data-page': { file: 'data-page.jpg', width: 1026, height: 1009 },
    'data-reset-dialog': { file: 'data-reset-dialog.jpg', width: 524, height: 194 },
    'dish-cost': { file: 'dish-cost.jpg', width: 1232, height: 451 },
    'dish-form': { file: 'dish-form.jpg', width: 1232, height: 452 },
    'dish-lines': { file: 'dish-lines.jpg', width: 1232, height: 742 },
    'help-toolbar': { file: 'help-toolbar.jpg', width: 647, height: 68 },
    'ingredient-add': { file: 'ingredient-add.jpg', width: 524, height: 584 },
    'ingredient-delete': { file: 'ingredient-delete.jpg', width: 524, height: 217 },
    'ingredient-history': { file: 'ingredient-history.jpg', width: 684, height: 381 },
    'ingredient-in-use': { file: 'ingredient-in-use.jpg', width: 524, height: 370 },
    'ingredient-price': { file: 'ingredient-price.jpg', width: 524, height: 469 },
    'ingredient-rename': { file: 'ingredient-rename.jpg', width: 524, height: 286 },
    'ingredients-list': { file: 'ingredients-list.jpg', width: 1232, height: 799 },
    menu: { file: 'menu.jpg', width: 1280, height: 81 },
    'prep-cost': { file: 'prep-cost.jpg', width: 1232, height: 271 },
    'prep-form': { file: 'prep-form.jpg', width: 1232, height: 334 },
    'prep-lines': { file: 'prep-lines.jpg', width: 1232, height: 574 },
    'simulator-baseline': { file: 'simulator-baseline.jpg', width: 1232, height: 212 },
    'simulator-compare': { file: 'simulator-compare.jpg', width: 928, height: 1065 },
    'simulator-picker': { file: 'simulator-picker.jpg', width: 821, height: 324 },
    'simulator-prices': { file: 'simulator-prices.jpg', width: 260, height: 538 },
    'simulator-qty': { file: 'simulator-qty.jpg', width: 260, height: 504 },
    'simulator-scenario': { file: 'simulator-scenario.jpg', width: 296, height: 1145 },
    'simulator-stale': { file: 'simulator-stale.jpg', width: 258, height: 353 },
    'theme-language': { file: 'theme-language.jpg', width: 308, height: 76 },
  },
};

/** Address of a screenshot; works under the production sub-path because it starts from Vite's base. */
export function helpImageUrl(set: HelpImageSet, file: string): string {
  return `${import.meta.env.BASE_URL}help/${set}/${file}`;
}
