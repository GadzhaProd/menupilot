import type { ReactNode } from 'react';
import { Surface } from '@/components/ui/surface';
import type { RecipeCosts } from '@/ui/domain/recipeCosts';
import type { BaseUnit, Metrics } from '@/ui/domain/types';
import { formatQuantityLocale } from '@/ui/forms/numbers';
import { cn } from '@/lib/utils';
import { useLocale, useFormatters } from '@/ui/i18n';

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-right text-sm', strong && 'font-semibold')}>{children}</dd>
    </div>
  );
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
  const { t, locale } = useLocale();
  const f = useFormatters();
  const Unknown = () => <span className="text-muted-foreground">{t('common.costUnknown')}</span>;
  const percent = (value: bigint | null, metrics: Metrics) => metrics.status === 'cost-unknown'
    ? <Unknown /> : metrics.status === 'price-zero' || value === null ? <span className="text-muted-foreground" title={t('recipe.notApplicableHint')}>{t('common.notApplicable')}</span> : f.percent(value);
  let body: ReactNode;
  if (costs === null) {
    body = <p className="text-sm text-muted-foreground">{t('recipe.costHint')}</p>;
  } else if ('error' in costs) {
    body = <p role="alert" className="text-sm text-negative">{t('recipe.costFail')}</p>;
  } else if (kind === 'dish' && costs.dish !== null) {
    const metrics = costs.dish;
    body = (
      <dl className="divide-y">
        <Row label={t('recipe.batchCost')}>{costs.batchCostMicro === null ? <Unknown /> : f.microMoney(costs.batchCostMicro)}</Row>
        <Row label={t('recipe.costPerPortion')} strong>
          {metrics.recipeCostPerPortionMicro === null ? <Unknown /> : f.microMoney(metrics.recipeCostPerPortionMicro)}
        </Row>
        {menuPriceInclVatCents === null ? null : <Row label={t('recipe.menuPrice')}>{f.money(menuPriceInclVatCents)}</Row>}
        <Row label={t('recipe.priceExclVat')}>{f.microMoney(metrics.priceExclVatMicro)}</Row>
        <Row label={t('recipe.contributionPerPortion')} strong>
          {metrics.contributionMicro === null ? <Unknown /> : f.microMoney(metrics.contributionMicro)}
        </Row>
        <Row label={t('terms.foodCost')}>{percent(metrics.foodCostTenthsPct, metrics)}</Row>
        <Row label={t('recipe.contributionMargin')}>{percent(metrics.contributionMarginTenthsPct, metrics)}</Row>
        {metrics.monthlyContributionCents === null ? null : (
          <Row label={t('recipe.monthlyContribution')}>{f.money(metrics.monthlyContributionCents)}</Row>
        )}
      </dl>
    );
  } else {
    body = (
      <dl className="divide-y">
        <Row label={t('recipe.batchCost')} strong>{costs.batchCostMicro === null ? <Unknown /> : f.microMoney(costs.batchCostMicro)}</Row>
        {outputMilli !== null && outputUnit !== null ? <Row label={t('recipe.outputMakes')}>{formatQuantityLocale(outputMilli, outputUnit, locale)}</Row> : null}
        <Row label={t('recipe.costPerOutputUnit')} strong>{outputMilli !== null && outputUnit !== null ? f.prepCost(costs.batchCostMicro, outputMilli, outputUnit) : <Unknown />}</Row>
      </dl>
    );
  }

  const unknownNote = costs !== null && !('error' in costs) && costs.batchCostMicro === null
    ? !hasLines
      ? t('recipe.addLineForCost')
      : missing.length > 0 ? t('recipe.noPriceFor', { names: missing.join(', ') }) : null
    : null;

  return (
    <Surface aria-labelledby="cost-summary-title" className="space-y-4">
      <div className="space-y-1"><h2 id="cost-summary-title" className="text-xl font-semibold">{t('recipe.costSummary')}</h2><p className="max-w-prose text-muted-foreground">{kind === 'dish' ? t('recipe.costDescriptionDish') : t('recipe.costDescriptionPrep')}</p></div>
      <div aria-live="polite" className="space-y-2">
        {body}
        {unknownNote ? <p className="text-sm text-muted-foreground">{unknownNote}</p> : null}
      </div>
    </Surface>
  );
}
