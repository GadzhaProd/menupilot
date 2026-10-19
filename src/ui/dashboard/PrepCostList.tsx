import { Surface } from '@/components/ui/surface';
import type { DashboardPrepRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';
import { useFormatters, useLocale } from '@/ui/i18n';
export function PrepCostList({ rows }: { rows: readonly DashboardPrepRow[] }) {
  const { t } = useLocale(); const f = useFormatters();
  return <Surface aria-labelledby="preps-title">
    <h2 id="preps-title" className="text-xl font-semibold">{t('dashboard.preps')}</h2>
    <p className="mb-4 text-sm text-muted-foreground">{t('dashboard.prepHint')}</p>
    {rows.length === 0 ? <p>{t('dashboard.noPreps')}</p> : <div className="divide-y divide-line">{rows.map((row) =>
      <div key={row.id} className="grid gap-3 py-4 sm:grid-cols-3">
        <a href={hrefFor({ name: 'recipe', id: row.id })} className="font-semibold underline-offset-4 hover:underline">{row.name}</a>
        <div><span className="text-xs text-muted-foreground">{t('common.before')}</span><p className="tabular-nums">{row.noPriceOnDate ? t('dashboard.noPrice') : f.prepCost(row.comparisonBatchMicro, row.outputMilli, row.outputUnit) ?? t('common.costUnknown')}</p></div>
        <div><span className="text-xs text-muted-foreground">{t('common.after')}</span><p className="font-semibold tabular-nums">{f.prepCost(row.currentBatchMicro, row.outputMilli, row.outputUnit) ?? t('common.costUnknown')}</p></div>
      </div>)}</div>}
  </Surface>;
}
