import { useLocale, useFormatters } from '@/ui/i18n';
import type { ReactNode } from 'react';
import type { Run } from '@/ui/domain/simulator';
import type { SimulateResult } from '@/ui/domain/types';
import { DASH, useSimulatorFormat } from './format';

function Metric({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return (
    <div className="space-y-2">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
        <dd className="text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function Cards({ result }: { result: SimulateResult }) {
  const { t, plural } = useLocale(); const f = useFormatters(); const { euro, costText, percentText } = useSimulatorFormat();
  return (
    <dl className="grid gap-6 border-y border-line bg-surface p-5 sm:grid-cols-2 xl:grid-cols-5">
      <Metric
        label={t('simulator.menuPrice')}
        value={euro(result.menuPriceInclVatCents)}
        note={<>{euro(result.netPriceCents)} {t('common.exclVat')}</>}
      />
      <Metric
        label={t('simulator.cost')}
        value={costText(result)}
        note={t('simulator.portionHint')}
      />
      <Metric
        label={t('simulator.contribution')}
        value={euro(result.contributionCents)}
        note={t('simulator.otherCosts')}
      />
      <Metric
        label={t('simulator.foodCost')}
        value={percentText(result, result.foodCostPct)}
        note={t('simulator.marginValue', { value: percentText(result, result.marginPct) })}
      />
      <Metric
        label={t('simulator.monthly')}
        value={euro(result.monthlyContributionCents)}
        note={result.monthlyVolume === null ? t('simulator.enterVolume') : plural('simulator.sold', result.monthlyVolume, { count: f.integer(result.monthlyVolume) })}
      />
    </dl>
  );
}

/** Baseline: the dish exactly as it is in your data today. Scenarios never change it. */
export function BaselineCards({ run }: { run: Run }) {
  const { t } = useLocale();
  if (!run.ok) {
    return <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{t('simulator.failedBaseline')}</p>;
  }
  return (
    <section aria-labelledby="baseline-title" className="space-y-2">
      <h2 id="baseline-title" className="text-lg font-semibold">{t('simulator.baseline')} <span className="text-sm font-normal text-muted-foreground">· {t('simulator.realToday')}</span></h2>
      <Cards result={run.result} />
      {run.result.status === 'cost-unknown' ? (
        <p className="text-sm text-muted-foreground">{DASH} {t('simulator.unknownHint')}</p>
      ) : null}
    </section>
  );
}
