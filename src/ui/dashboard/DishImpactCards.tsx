import type { DashboardDishRow } from '@/ui/domain/dashboard';
import { hrefFor } from '@/ui/router/routes';
import { useLocale } from '@/ui/i18n';
import { contributionTone, costTone, useDishFigures } from './useDishFigures';

export function DishImpactCards({ rows }: { rows: readonly DashboardDishRow[] }) {
  const { t } = useLocale();
  const figures = useDishFigures();
  return <section aria-label={t('dashboard.cards')} className="divide-y divide-line md:hidden print:hidden">
    <h2 className="sr-only">{t('dashboard.comparison')}</h2>
    {rows.map((row) => {
      const v = figures(row);
      return <article key={row.id} className="space-y-4 py-5">
        <h3 className="font-semibold"><a href={hrefFor({ name: 'recipe', id: row.id })}>{row.name}</a></h3>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {[[t('common.before'), v.before, ''], [t('dashboard.now'), v.now, 'font-semibold'], [t('dashboard.change'), v.change, costTone(row.costDeltaCents)]].map(([label, value, tone]) =>
            <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 break-words tabular-nums ${tone}`}>{value}</dd></div>)}
        </dl>
        <div className="flex justify-between gap-4 text-sm"><span>{t('dashboard.monthly')}</span><strong className={`text-right tabular-nums ${contributionTone(row.monthlyImpactCents)}`}>{v.monthly}</strong></div>
        <details><summary className="flex min-h-12 cursor-pointer items-center text-sm underline underline-offset-4">{t('dashboard.allFigures')}</summary>
          <dl className="space-y-3 pb-3 text-sm">{[[t('dashboard.menuPrice'), v.menu], [t('dashboard.netPrice'), v.net], [t('dashboard.foodChange'), v.points], [t('dashboard.contribution'), v.contribution]].map(([label, value]) =>
            <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="text-right tabular-nums">{value}</dd></div>)}
          </dl>
        </details>
        <a className="inline-flex min-h-12 items-center underline underline-offset-4" href={hrefFor({ name: 'simulator', id: row.id })}>{t('dashboard.simulate')}</a>
      </article>;
    })}
  </section>;
}
