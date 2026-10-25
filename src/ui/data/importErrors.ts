import type { ImportValidationDetail } from './DataProvider';
import type { Translate } from '@/ui/i18n';

/** Converts the store's structured validation details into owner-facing import messages. */
export function localizedImportError(
  t: Translate,
  code: string,
  _details: readonly string[],
  issues: readonly ImportValidationDetail[] = [],
): string {
  if (code === 'corrupt-json') return t('data.importError.json');
  if (code === 'unsupported-version') return t('data.importError.version');
  if (code !== 'invalid') return t('data.importError.generic');
  const issue = issues[0];
  if (!issue) return t('data.importError.invalid');
  if (issue.code === 'negative-price' && issue.entityName) return t('data.importError.price', { name: issue.entityName });
  if (issue.code === 'prep-depth' && issue.entityName) return t('data.importError.depth', { name: issue.entityName });
  if (issue.code === 'prep-cycle' && issue.relatedNames?.length) return t('data.importError.cycle', { names: issue.relatedNames.join(' → ') });
  if (issue.code === 'unknown-ingredient' && issue.entityName && issue.relatedId) return t('data.importError.reference', { name: issue.entityName, id: issue.relatedId });
  return t('data.importError.invalid');
}
