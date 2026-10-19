import type { HelpImageId } from './types';

export interface HelpImageFile {
  /** File name inside public/help. */
  readonly file: string;
  /** Size on screen in CSS pixels (the pictures are saved at 1.5 times this, so they stay sharp when zoomed). */
  readonly width: number;
  readonly height: number;
}

/**
 * Real screenshots of the demo cafe, cropped to the part of the screen a step talks about.
 * They show the English screen, so both languages use the same files; only alt text and captions differ.
 * The files live in public/help and are loaded lazily.
 */
export const HELP_IMAGES: Record<HelpImageId, HelpImageFile> = {
  'dashboard-cards': { file: 'dashboard-cards.jpg', width: 768, height: 200 },
  'dashboard-picker': { file: 'dashboard-picker.jpg', width: 768, height: 68 },
  'dashboard-preps': { file: 'dashboard-preps.jpg', width: 768, height: 263 },
  'dashboard-table': { file: 'dashboard-table.jpg', width: 968, height: 612 },
  'data-backup': { file: 'data-backup.jpg', width: 776, height: 360 },
  'data-empty-dialog': { file: 'data-empty-dialog.jpg', width: 512, height: 186 },
  'data-page': { file: 'data-page.jpg', width: 800, height: 957 },
  'data-reset-dialog': { file: 'data-reset-dialog.jpg', width: 512, height: 228 },
  'dish-cost': { file: 'dish-cost.jpg', width: 768, height: 381 },
  'dish-form': { file: 'dish-form.jpg', width: 768, height: 362 },
  'dish-lines': { file: 'dish-lines.jpg', width: 768, height: 614 },
  'help-toolbar': { file: 'help-toolbar.jpg', width: 768, height: 48 },
  'ingredient-add': { file: 'ingredient-add.jpg', width: 512, height: 462 },
  'ingredient-delete': { file: 'ingredient-delete.jpg', width: 512, height: 166 },
  'ingredient-history': { file: 'ingredient-history.jpg', width: 672, height: 276 },
  'ingredient-in-use': { file: 'ingredient-in-use.jpg', width: 512, height: 288 },
  'ingredient-price': { file: 'ingredient-price.jpg', width: 512, height: 370 },
  'ingredient-rename': { file: 'ingredient-rename.jpg', width: 512, height: 218 },
  'ingredients-list': { file: 'ingredients-list.jpg', width: 1000, height: 470 },
  menu: { file: 'menu.jpg', width: 800, height: 57 },
  'prep-cost': { file: 'prep-cost.jpg', width: 768, height: 216 },
  'prep-form': { file: 'prep-form.jpg', width: 768, height: 268 },
  'prep-lines': { file: 'prep-lines.jpg', width: 768, height: 466 },
  'simulator-baseline': { file: 'simulator-baseline.jpg', width: 800, height: 546 },
  'simulator-compare': { file: 'simulator-compare.jpg', width: 768, height: 674 },
  'simulator-picker': { file: 'simulator-picker.jpg', width: 768, height: 414 },
  'simulator-prices': { file: 'simulator-prices.jpg', width: 334, height: 324 },
  'simulator-qty': { file: 'simulator-qty.jpg', width: 334, height: 248 },
  'simulator-scenario': { file: 'simulator-scenario.jpg', width: 376, height: 628 },
  'simulator-stale': { file: 'simulator-stale.jpg', width: 326, height: 210 },
};

/** Address of a screenshot; works under the production sub-path because it starts from Vite's base. */
export function helpImageUrl(file: string): string {
  return `${import.meta.env.BASE_URL}help/${file}`;
}
