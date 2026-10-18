import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEURFromCents, formatEURFromMicro } from '@/ui/domain/calc';
import type { RecipeCosts } from '@/ui/domain/recipeCosts';
import type { BaseUnit, Metrics } from '@/ui/domain/types';
import { formatQuantity, formatTenthsPct } from '@/ui/forms/numbers';
import { cn } from '@/lib/utils';

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-right text-sm', strong && 'font-semibold')}>{children}</dd>
    </div>
  );
}

const Unknown = () => <span className="text-muted-foreground">cost unknown</span>;
const NotApplicable = () => <span className="text-muted-foreground" title="The menu price is €0.00, so a percentage makes no sense">n/a</span>;

function percent(value: bigint | null, metrics: Metrics) {
  if (metrics.status === 'cost-unknown') return <Unknown />;
  if (metrics.status === 'price-zero' || value === null) return <NotApplicable />;
  return formatTenthsPct(value);
}

interface CostSummaryProps {
  kind: 'dish' | 'prep';
  /** null while the form still has errors; `error` when the calculation itself failed. */
  costs: RecipeCosts | { error: string } | null;
  menuPriceInclVatCents: number | null;
  outputMilli: number | null;
  outputUnit: BaseUnit | null;
  /** Ingredients and preps in the recipe that have no price yet. */
  missing: readonly string[];
  hasLines: boolean;
}

/** All numbers come from src/calc through src/ui/domain; this component only lays them out. */
export function CostSummary({ kind, costs, menuPriceInclVatCents, outputMilli, outputUnit, missing, hasLines }: CostSummaryProps) {
  let body: ReactNode;
  if (costs === null) {
    body = <p className="text-sm text-muted-foreground">Fill in the highlighted fields to see the cost.</p>;
  } else if ('error' in costs) {
    body = <p role="alert" className="text-sm text-destructive">The cost cannot be calculated: {costs.error}</p>;
  } else if (kind === 'dish' && costs.dish !== null) {
    const metrics = costs.dish;
    body = (
      <dl className="divide-y">
        <Row label="Batch cost, all portions (excl. VAT)">{costs.batchCostMicro === null ? <Unknown /> : formatEURFromMicro(costs.batchCostMicro)}</Row>
        <Row label="Recipe-based ingredient cost per portion (excl. VAT)" strong>
          {metrics.recipeCostPerPortionMicro === null ? <Unknown /> : formatEURFromMicro(metrics.recipeCostPerPortionMicro)}
        </Row>
        {menuPriceInclVatCents === null ? null : <Row label="Menu price (incl. VAT)">{formatEURFromCents(menuPriceInclVatCents)}</Row>}
        <Row label="Price excl. VAT">{formatEURFromMicro(metrics.priceExclVatMicro)}</Row>
        <Row label="Contribution per portion (before other costs)" strong>
          {metrics.contributionMicro === null ? <Unknown /> : formatEURFromMicro(metrics.contributionMicro)}
        </Row>
        <Row label="Food cost %">{percent(metrics.foodCostTenthsPct, metrics)}</Row>
        <Row label="Contribution margin %">{percent(metrics.contributionMarginTenthsPct, metrics)}</Row>
        {metrics.monthlyContributionCents === null ? null : (
          <Row label="Estimated monthly contribution (your volume estimate, not a forecast)">{formatEURFromCents(metrics.monthlyContributionCents)}</Row>
        )}
      </dl>
    );
  } else {
    body = (
      <dl className="divide-y">
        <Row label="Batch cost (excl. VAT)" strong>{costs.batchCostMicro === null ? <Unknown /> : formatEURFromMicro(costs.batchCostMicro)}</Row>
        {outputMilli !== null && outputUnit !== null ? <Row label="One batch makes">{formatQuantity(outputMilli, outputUnit)}</Row> : null}
        <Row label="Cost per kg, l or pc (excl. VAT)" strong>{costs.prepUnitCost ?? <Unknown />}</Row>
      </dl>
    );
  }

  const unknownNote = costs !== null && !('error' in costs) && costs.batchCostMicro === null
    ? !hasLines
      ? 'Add at least one ingredient or prep to see a cost.'
      : missing.length > 0 ? `No price yet for: ${missing.join(', ')}.` : null
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost</CardTitle>
        <CardDescription>
          {kind === 'dish'
            ? 'Theoretical cost from the recipe, not actual usage. Updates as you type; saved when you press Save.'
            : 'Theoretical cost of one batch, not actual usage. Updates as you type; saved when you press Save.'}
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite" className="space-y-2">
        {body}
        {unknownNote ? <p className="text-sm text-muted-foreground">{unknownNote}</p> : null}
      </CardContent>
    </Card>
  );
}
