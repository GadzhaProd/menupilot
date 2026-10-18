import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { Run } from '@/ui/domain/simulator';
import type { SimulateResult } from '@/ui/domain/types';
import { costText, DASH, euro, percentText } from './format';

function Metric({ label, value, note }: { label: string; value: ReactNode; note: ReactNode }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1 px-4">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
        <dd className="text-xs text-muted-foreground">{note}</dd>
      </CardContent>
    </Card>
  );
}

function Cards({ result }: { result: SimulateResult }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Metric
        label="Menu price (incl. VAT)"
        value={euro(result.menuPriceInclVatCents)}
        note={<>{euro(result.netPriceCents)} excl. VAT · VAT {result.vatRateBp / 100}%</>}
      />
      <Metric
        label="Recipe-based ingredient cost"
        value={costText(result)}
        note="per portion, excl. VAT"
      />
      <Metric
        label="Contribution per portion"
        value={euro(result.contributionCents)}
        note="before other costs"
      />
      <Metric
        label="Food cost %"
        value={percentText(result, result.foodCostPct)}
        note={<>Contribution margin {percentText(result, result.marginPct)}</>}
      />
      <Metric
        label="Estimated monthly contribution"
        value={euro(result.monthlyContributionCents)}
        note={result.monthlyVolume === null ? 'Enter your sales per month' : `${result.monthlyVolume} sold per month, your estimate`}
      />
    </dl>
  );
}

/** Baseline: the dish exactly as it is in your data today. Scenarios never change it. */
export function BaselineCards({ run }: { run: Run }) {
  if (!run.ok) {
    return <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Baseline cannot be calculated: {run.error}</p>;
  }
  return (
    <section aria-labelledby="baseline-title" className="space-y-2">
      <h2 id="baseline-title" className="text-lg font-semibold">Baseline <span className="text-sm font-normal text-muted-foreground">· your real data today</span></h2>
      <Cards result={run.result} />
      {run.result.status === 'cost-unknown' ? (
        <p className="text-sm text-muted-foreground">{DASH} Some ingredient has no price yet, so the cost is unknown. Add the price on the Ingredients screen.</p>
      ) : null}
    </section>
  );
}
