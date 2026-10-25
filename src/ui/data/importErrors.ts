import type { Translate } from '@/ui/i18n';

/** Converts stable store validation details into owner-facing import messages. */
export function localizedImportError(t: Translate, code: string, details: readonly string[], raw = ''): string {
  if (code === 'corrupt-json') return t('data.importError.json');
  if (code === 'unsupported-version') return t('data.importError.version');
  if (code !== 'invalid') return t('data.importError.generic');
  let document: any = null;
  try { document = JSON.parse(raw); } catch { /* Details still provide a useful fallback. */ }
  for (const detail of details) {
    const path = /^(?:.*?\.)?(ingredients|recipes)\[(\d+)\]/.exec(detail);
    const entity = path && path[1] ? document?.[path[1]]?.[Number(path[2])] : null;
    if (/packPriceCents: must be an integer of at least 0/.test(detail) && entity?.name) return t('data.importError.price', { name: entity.name });
    const depth = /prep nesting depth/.test(detail);
    if (depth && entity?.name) return t('data.importError.depth', { name: entity.name });
    const cycle = /prep cycle (.+)$/.exec(detail);
    if (cycle) return t('data.importError.cycle', { names: cycle[1] ?? '' });
    const missing = /unknown ingredient '([^']+)'/.exec(detail);
    if (missing && entity?.name) return t('data.importError.reference', { name: entity.name, id: missing[1] ?? '' });
  }
  return t('data.importError.invalid');
}
