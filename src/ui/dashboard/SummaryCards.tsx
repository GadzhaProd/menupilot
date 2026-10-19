import type { DashboardData } from '@/ui/domain/dashboard';
import { useFormatters, useLocale } from '@/ui/i18n';
export function SummaryCards({ data }: { data: DashboardData }) {
  const { t } = useLocale(); const f = useFormatters();
  return <section aria-labelledby="summary-title" className="border-t border-line pt-6">
    <h2 id="summary-title" className="mb-4 text-xl font-semibold">{t('dashboard.summary')}</h2>
    <dl className="grid gap-6 sm:grid-cols-3">{[
      [t('dashboard.expensive'), String(data.gotMoreExpensive)],
      [t('dashboard.average'), f.percent(data.averageFoodCostTenthsPct)],
      [t('dashboard.noVolume'), String(data.excludedWithoutVolume)],
    ].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 font-heading text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl>
  </section>;
}
