import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { highestMonthly, type Run, type ScenarioDelta } from '@/ui/domain/simulator';
import type { SimulateResult } from '@/ui/domain/types';
import { useLocale } from '@/ui/i18n';
import type { en, TranslationKey } from '@/ui/i18n/en';
import { DASH, Delta, useSimulatorFormat } from './format';

export interface Column {
  key: string; label: string; kind: 'baseline' | 'scenario'; run: Run;
  delta: ScenarioDelta | null; stale: boolean;
}
type TextKey = { [K in TranslationKey]: (typeof en)[K] extends `${string}{${string}` ? never : K }[TranslationKey];
interface Row {
  label: TextKey; hint?: TextKey;
  value: (result: SimulateResult) => ReactNode;
  delta?: (delta: ScenarioDelta) => ReactNode;
  emphasis?: boolean;
}
function leftOutReason(column: Column): TextKey | null {
  if (!column.run.ok) return 'simulator.reasonFailed';
  if (column.stale) return 'simulator.older';
  if (column.run.result.monthlyContributionCents !== null) return null;
  if (column.run.result.status === 'cost-unknown') return 'common.costUnknown';
  return column.run.result.monthlyVolume === null ? 'simulator.reasonVolume' : 'simulator.reasonMonthly';
}
const monthlyOf = (column: Column) => ({ key: column.key,
  monthlyCents: leftOutReason(column) === null && column.run.ok ? column.run.result.monthlyContributionCents : null });

function Highest({ columns }: { columns: readonly Column[] }) {
  const { t } = useLocale(); const { euro } = useSimulatorFormat();
  const best = highestMonthly(columns.map(monthlyOf));
  const leftOut = columns.flatMap(column => {
    const reason = leftOutReason(column);
    return reason === null ? [] : [`${column.label} (${t(reason)})`];
  });
  const names = best === null ? [] : columns.filter(column => best.keys.includes(column.key)).map(column => column.label);
  return <p data-testid="highest-monthly" className="border-t border-line pt-4 text-sm">
    {best === null ? <><strong>{t('simulator.notEnough')}</strong> {leftOut.length === 0 && t('simulator.enterToCompare')}</>
      : names.length > 1 ? t('simulator.tie', { names: names.join(` ${t('simulator.and')} `), value: euro(best.cents) })
        : best.keys[0] === 'baseline' ? t('simulator.bestBaseline', { value: euro(best.cents) })
          : t('simulator.best', { name: names[0]!, value: euro(best.cents) })}
    {leftOut.length > 0 && <> {t('simulator.leftOut', { names: leftOut.join(', ') })}</>}
  </p>;
}

export function ComparisonTable({ columns, activeKey }: { columns: readonly Column[]; activeKey?: string }) {
  const { t } = useLocale();
  const { euro, costText, percentText, signedEuro, signedPoints } = useSimulatorFormat();
  const best = highestMonthly(columns.map(monthlyOf));
  const comparable = columns.filter(c => leftOutReason(c) === null).length;
  const winners = new Set(best !== null && best.keys.length < comparable ? best.keys : []);
  const rows: Row[] = [
    { label: 'simulator.menuPrice', value: r => euro(r.menuPriceInclVatCents) },
    { label: 'simulator.netPrice', hint: 'simulator.calculationHint', value: r => euro(r.netPriceCents) },
    { label: 'simulator.cost', hint: 'simulator.portionHint', value: costText, delta: d => <Delta value={d.ingredientCostDeltaCents} format={signedEuro} better="lower" /> },
    { label: 'simulator.contribution', hint: 'simulator.otherCosts', value: r => euro(r.contributionCents), delta: d => <Delta value={d.contributionDeltaCents} format={signedEuro} better="higher" /> },
    { label: 'simulator.foodCost', value: r => percentText(r, r.foodCostPct), delta: d => <Delta value={d.foodCostDeltaTenthsPct} format={signedPoints} better="lower" /> },
    { label: 'simulator.margin', value: r => percentText(r, r.marginPct) },
    { label: 'simulator.volume', hint: 'simulator.estimate', value: r => r.monthlyVolume === null ? DASH : String(r.monthlyVolume) },
    { label: 'simulator.monthly', hint: 'simulator.monthlyHint', value: r => euro(r.monthlyContributionCents), delta: d => <Delta value={d.monthlyContributionDeltaCents} format={signedEuro} better="higher" />, emphasis: true },
  ];
  const columnClass = (c: Column) => cn(c.kind === 'scenario' && c.key !== activeKey && 'sim-inactive-column', c.key === activeKey && 'bg-panel');
  return <section aria-labelledby="compare-title" className="min-w-0 space-y-4 lg:col-start-2">
    <div><h2 id="compare-title" className="text-xl font-semibold">{t('simulator.compare')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('simulator.compareHint')}</p></div>
    <Table className="sim-comparison table-fixed bg-surface">
      <TableHeader><TableRow className="hover:bg-transparent">
        <TableHead className="w-[30%] whitespace-normal align-bottom">{t('simulator.comparison')}</TableHead>
        {columns.map(column => <TableHead key={column.key} scope="col" className={cn('whitespace-normal text-right align-bottom', columnClass(column))}>
          <span className="block font-semibold break-words">{column.label}</span>
          {column.kind === 'baseline' && <span className="block text-xs text-muted-foreground">{t('simulator.today')}</span>}
          {column.stale && <span className="block text-xs text-accent-foreground">{t('simulator.older')}</span>}
          {!column.run.ok && <span className="block text-xs text-negative">{t('simulator.cannotCalculate')}</span>}
          {winners.has(column.key) && <span className="block text-xs">{t('simulator.highest')}</span>}
        </TableHead>)}
      </TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.label} className={row.emphasis ? 'border-t-2 font-semibold' : undefined}>
        <TableHead scope="row" className="whitespace-normal py-4 font-normal"><span>{t(row.label)}</span>{row.hint && <span className="mt-1 block text-xs text-muted-foreground">{t(row.hint)}</span>}</TableHead>
        {columns.map(column => <TableCell key={column.key} className={cn('whitespace-normal text-right align-top', columnClass(column))}>
          {column.run.ok ? <div className="flex flex-col items-end gap-1"><span className={cn('money-value break-words', row.label !== 'simulator.contribution' && !row.emphasis && 'font-normal')}>{row.value(column.run.result)}</span>{row.delta && column.delta ? row.delta(column.delta) : null}</div> : DASH}
        </TableCell>)}
      </TableRow>)}
        <TableRow className="border-t-4 border-double border-line font-semibold">
          <TableHead scope="row" className="whitespace-normal py-4">{t('simulator.monthlyDelta')}<span className="mt-1 block text-xs font-normal text-muted-foreground">{t('simulator.againstBaseline')}</span></TableHead>
          {columns.map(column => <TableCell key={column.key} className={cn('whitespace-normal text-right', columnClass(column))}>{column.delta ? <Delta value={column.delta.monthlyContributionDeltaCents} format={signedEuro} better="higher" /> : DASH}</TableCell>)}
        </TableRow>
      </TableBody>
    </Table>
    <Highest columns={columns} />
    {columns.some(c => c.stale) && <p className="text-sm text-muted-foreground">{t('simulator.staleHint')}</p>}
    <p className="text-sm text-muted-foreground">{t('simulator.disclaimer')}</p>
  </section>;
}
