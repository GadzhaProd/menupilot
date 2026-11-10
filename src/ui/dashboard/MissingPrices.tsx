import type { DashboardDishRow } from '@/ui/domain/dashboard';
import { summarizeUsers } from '@/ui/forms/usage';
import { hrefFor } from '@/ui/router/routes';
import { useLocale } from '@/ui/i18n';

/** The calc result includes ingredients from every reachable prep, without duplicates. */
export function MissingPrices({ row }: { row: DashboardDishRow }) {
  const { t } = useLocale();
  if (row.status !== 'no-price-on-date' || row.missingPrices.length === 0) return null;
  const { shown, more } = summarizeUsers(row.missingPrices);
  return <p data-testid="missing-prices" className="mt-2 text-sm font-normal text-muted-foreground">
    {t('prices.missingOnDate')} {shown.map(item => item.name).join(', ')}{more > 0 ? `; ${t('prices.andMore', { count: more })}` : ''}.{' '}
    <a className="inline-flex min-h-12 items-center underline underline-offset-4" href={hrefFor({ name: 'ingredients' })}>{t('ingredients.title')}</a>
  </p>;
}
