import type { Translate, Locale } from '@/ui/i18n';

/** Turns store failures into sentences for the owner. Raw validation paths stay out of the UI. */

const MAX_DEPTH = /prep nesting depth is (\d+); the maximum is (\d+)/;
const CYCLE = /prep cycle (.+)$/;

export function friendlySaveError(message: string, details: readonly string[]): string {
  for (const detail of details) {
    const cycle = CYCLE.exec(detail);
    if (cycle) {
      const names = (cycle[1] ?? '').replaceAll(' -> ', ' uses ');
      return `Saving this would make preps use each other in a loop (${names}). A prep cannot contain itself, directly or through other preps.`;
    }
    const depth = MAX_DEPTH.exec(detail);
    if (depth) {
      return `Preps can be nested at most ${depth[2]} levels deep; this would make ${depth[1]}. Simplify the preps first.`;
    }
  }
  return message;
}

/** Localizes recipe graph failures from the store's stable code and validation details. */
export function localizedRecipeSaveError(
  locale: Locale,
  t: Translate,
  code: string,
  message: string,
  details: readonly string[],
): string {
  if (locale === 'en') return friendlySaveError(message, details);
  if (code === 'invalid') {
    for (const detail of details) {
      const cycle = CYCLE.exec(detail);
      if (cycle) return t('recipe.error.cycle', { names: cycle[1] ?? '' });
      const depth = MAX_DEPTH.exec(detail);
      if (depth) return t('recipe.error.depth', { attempted: depth[1] ?? '', max: depth[2] ?? '' });
    }
  }
  if (code === 'in-use') return t('recipe.error.inUse');
  return t('error.generic');
}
