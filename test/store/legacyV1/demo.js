/**
 * data/demo.json is written as if "now" were this moment: every demo price was
 * recorded before it, and the Classic Burger example (EUR 4.20 -> 4.85) holds for
 * any comparison date from 60 to 30 days before it.
 */
export const DEMO_REFERENCE_NOW = '2026-10-18T12:00:00.000Z';

/**
 * Move all demo price timestamps so that DEMO_REFERENCE_NOW lands on `nowIso`.
 * Relative distances (e.g. "price changed 16 days ago") are preserved, so the
 * demo behaves the same whenever the app is opened. The demo has no scenarios.
 * @param {object} demo Parsed data/demo.json (not modified).
 * @param {string} nowIso Current time as an ISO timestamp.
 * @returns {object} A shifted deep copy.
 */
export function shiftDemoDates(demo, nowIso) {
  const shiftMs = Date.parse(nowIso) - Date.parse(DEMO_REFERENCE_NOW);
  const shifted = structuredClone(demo);
  for (const ingredient of shifted.ingredients) {
    for (const price of ingredient.prices) {
      price.recordedAt = new Date(Date.parse(price.recordedAt) + shiftMs).toISOString();
    }
  }
  return shifted;
}
