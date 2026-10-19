import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDocument } from '@/ui/data/DataProvider';
import { dashboardData, largestCostIncrease } from '@/ui/domain/dashboard';
import { ComparisonPicker } from '@/ui/dashboard/ComparisonPicker';
import { DishImpactCards } from '@/ui/dashboard/DishImpactCards';
import { DishImpactTable } from '@/ui/dashboard/DishImpactTable';
import { PrepCostList } from '@/ui/dashboard/PrepCostList';
import { SummaryCards } from '@/ui/dashboard/SummaryCards';
import { useFormatters, useLocale } from '@/ui/i18n';
import { Surface } from '@/components/ui/surface';
import { MoneyValue, BeforeAfter } from '@/components/ui/money-value';
import { useDishFigures } from '@/ui/dashboard/useDishFigures';
import { EmptyState } from '@/components/ui/empty-state';
import { HelpLink } from '@/ui/help/HelpLink';
import { hrefFor } from '@/ui/router/routes';

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setTime(date.getTime() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function isSelectableDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const year = Number(date.slice(0, 4));
  if (year < 1000 || year > 9999) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === date
    && date <= new Date().toISOString().slice(0, 10);
}

export function DashboardPage() {
  const document = useDocument();
  const { t, plural } = useLocale();
  const f = useFormatters();
  const figures = useDishFigures();
  const [comparisonDate, setComparisonDate] = useState(() => dateDaysAgo(30));
  const [quickDays, setQuickDays] = useState('30');
  const comparisonInstant = `${comparisonDate}T23:59:59.999Z`;
  const data = useMemo(
    () => dashboardData(document, comparisonInstant),
    [document, comparisonInstant],
  );

  function selectPreset(days: number) {
    setQuickDays(String(days));
    setComparisonDate(dateDaysAgo(days));
  }

  function selectDate(date: string) {
    if (!isSelectableDate(date)) return;
    setQuickDays('');
    setComparisonDate(date);
  }

  const largest = largestCostIncrease(data.dishes);
  const total = data.totalMonthlyImpactCents;
  const reasons = [...new Set(data.dishes.filter(row => row.monthlyVolume !== null && row.monthlyImpactCents === null).map(row => row.status === 'no-price-on-date' ? t('dashboard.noPrice') : row.status === 'cost-unknown' ? t('common.costUnknown') : t('common.notApplicable')))];
  return <section aria-labelledby="page-title" className="space-y-8">
    <div className="space-y-2">
      <h1 id="page-title" className="text-[31px] leading-tight font-semibold sm:text-4xl">{t('dashboard.title')}</h1>
      <p className="text-muted-foreground">{t('dashboard.intro')}</p>
      <HelpLink section="dashboard" />
    </div>
    <div className="grid border-y border-line bg-surface lg:grid-cols-[0.6fr_1fr]">
      <section aria-labelledby="impact-title" className="space-y-3 p-5 sm:p-8">
        <h2 id="impact-title" className="text-xl font-semibold">{t('dashboard.monthly')}</h2>
        <MoneyValue value={total === null ? '—' : `${total > 0n ? '+' : ''}${f.money(total)}`} tone={total === null || total === 0n ? 'neutral' : total < 0n ? 'negative' : 'positive'} className="block text-[46px] leading-tight sm:text-[60px]" />
        {data.excludedWithVolume > 0 && <p className="text-sm">{t('dashboard.incomplete')}</p>}
        <p className="max-w-lg text-sm text-muted-foreground">{t('dashboard.monthlyHint')}</p>
        <p className="text-xs text-muted-foreground">{f.date(comparisonDate)} → {t('dashboard.now')} · {t('common.exclVat')}</p>
      </section>
      <section aria-labelledby="largest-title" className="space-y-4 border-t border-line p-5 sm:p-8 lg:border-t-0 lg:border-l">
        <h2 id="largest-title" className="text-sm text-muted-foreground">{t('dashboard.largest')}</h2>
        {largest ? <>
          <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-xl font-semibold">{largest.dish.name}</h3><span className="text-sm text-negative">{figures(largest.dish).change} {t('common.exclVat')}</span></div>
          <div className="[&_.text-3xl]:text-[42px] sm:[&_.text-3xl]:text-[48px]"><BeforeAfter before={f.microMoney(largest.dish.comparisonCostMicro!)} after={f.microMoney(largest.dish.currentCostMicro!)} tone="negative" beforeLabel={f.date(comparisonDate)} /></div>
          <p className="text-xs text-muted-foreground">{t('dashboard.perPortion')}</p>
          {largest.tied && <p className="text-sm">{t('dashboard.tied')}</p>}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="font-semibold text-negative">{figures(largest.dish).monthly} <span className="text-sm font-normal">{t('dashboard.monthly')}</span></p><p className="text-xs text-muted-foreground">{largest.dish.monthlyVolume === null ? t('simulator.noEstimate') : t('simulator.sold', { count: largest.dish.monthlyVolume })}</p></div>
            <Button asChild><a href={hrefFor({ name: 'simulator', id: largest.dish.id })}>{t('dashboard.try')}</a></Button>
          </div>
        </> : <p>{t('dashboard.noIncrease')}</p>}
      </section>
    </div>
    <ComparisonPicker comparisonDate={comparisonDate} quickDays={quickDays} onPreset={selectPreset} onDateChange={selectDate} />
    <Surface aria-labelledby="dishes-title" className="max-sm:px-4">
      <h2 id="dishes-title" className="text-xl font-semibold">{t('dashboard.dishes')}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{t('dashboard.perPortion')}</p>
      {data.dishes.length === 0 ? <EmptyState title={t('dashboard.dishes')} description={t('dashboard.empty')} action={<Button asChild><a href={hrefFor({ name: 'recipe-new', kind: 'dish' })}>{t('dashboard.add')}</a></Button>} /> : <>
        <DishImpactTable rows={data.dishes} comparisonDate={comparisonDate} />
        <DishImpactCards rows={data.dishes} />
      </>}
      <div className="mt-4 flex flex-wrap justify-between gap-3 border-t-2 border-line pt-5">
        <span>{t('dashboard.total')}</span><strong className="tabular-nums">{total === null ? '—' : f.money(total)}</strong>
        <div className="basis-full space-y-1 text-sm text-muted-foreground">
          <p>{plural('dashboard.withoutVolume', data.excludedWithoutVolume)}</p>
          {data.excludedWithVolume > 0 && <p>{t(data.excludedWithVolume === 1 ? 'dashboard.excludedSingular' : 'dashboard.excludedPlural', { count: data.excludedWithVolume, reasons: reasons.join(', ') })}</p>}
          <p>{t('dashboard.dishesHint')}</p>
        </div>
      </div>
    </Surface>
    <PrepCostList rows={data.preps} />
    <SummaryCards data={data} />
    <p className="text-xs text-muted-foreground">{t('dashboard.costHint')}</p>
    <p className="text-xs text-muted-foreground">{t('dashboard.reference')} <a className="underline" href="https://www.sligro.nl/inspiratie/rendement-kosten/kengetallen.html" target="_blank" rel="noreferrer">{t('dashboard.source')}</a></p>
  </section>;
}
