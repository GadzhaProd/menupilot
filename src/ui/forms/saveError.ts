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
