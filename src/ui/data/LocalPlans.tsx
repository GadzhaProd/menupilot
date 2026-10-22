import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useLocale, useFormatters } from '@/ui/i18n';
import type { PricePlan, PlanPackaging } from '@/ui/domain/plans';
import { useLocalMode } from './localMode';
import { createHttpPlanAdapter } from './httpPlanAdapter';

function Consequences({ plan }: { plan: PricePlan }) {
  const { t } = useLocale(), f = useFormatters();
  const cost = (v: string | null) => v === null ? t('common.costUnknown') : <span className="whitespace-nowrap">{f.microMoney(BigInt(v))}</span>;
  const pct = (v: string | null) => v === null ? '—' : f.percent(BigInt(v));
  return <div className="space-y-3 text-sm">
    {plan.effects.dishes.map(row => <div key={row.id} className="border-t pt-2">
      <p className="font-medium">{row.name}</p>
      <p>{t('plans.cost')}: {cost(row.comparisonCostMicro)} → {cost(row.currentCostMicro)}</p>
      <p>{t('plans.food')}: {pct(row.comparisonFoodCostTenthsPct)} → {pct(row.currentFoodCostTenthsPct)}</p>
      <p>{t('plans.monthly')}: {row.monthlyImpactCents === null ? '—' : <span className="whitespace-nowrap">{f.money(BigInt(row.monthlyImpactCents))}</span>}</p>
      {row.excludedReason && <p className="text-muted-foreground">{t(row.excludedReason === 'no-volume' ? 'plans.noVolume' : 'plans.unknown')}</p>}
    </div>)}
    {plan.effects.preps.map(row => <div key={row.id} className="border-t pt-2"><p className="font-medium">{row.name}</p><p>{t('plans.batch')}: {cost(row.comparisonBatchMicro)} → {cost(row.currentBatchMicro)}</p></div>)}
    <p className="font-semibold">{t('plans.total')}: {plan.effects.totalMonthlyImpactCents === null ? '—' : <span className="whitespace-nowrap">{f.money(BigInt(plan.effects.totalMonthlyImpactCents))}</span>}</p>
    <p>{t('plans.estimate')}</p><p>{t('plans.excluded', { volume: plan.effects.excludedWithoutVolume, unknown: plan.effects.excludedWithVolume })}</p>
  </div>;
}

export function LocalPlans() {
  const local = useLocalMode(), { t, locale } = useLocale(), f = useFormatters();
  const client = useMemo(() => local?.token ? createHttpPlanAdapter(local.token) : null, [local?.token]);
  const [plans, setPlans] = useState<readonly PricePlan[]>([]);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState<{ plan: PricePlan; action: 'apply' | 'reject' } | null>(null);
  const [busy, setBusy] = useState(false), saving = useRef(false);
  const [error, setError] = useState<string | null>(null), [done, setDone] = useState<'applied' | 'rejected' | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => client?.subscribe(value => { setFailed(value === null); if (value) setPlans(value); }), [client]);
  if (!local || !client) return null;
  const shown = plans.filter(p => !['applied', 'rejected'].includes(p.status));
  if (!shown.length && !failed && !done) return null;
  const per = (p: PlanPackaging | null) => p === null ? t('common.costUnknown') : <span className="whitespace-nowrap">{f.money(BigInt(p.unitPrice.cents))}/{p.unitPrice.per}</span>;
  function prices(plan: PricePlan) {
    const pack = (p: PlanPackaging | null) => p === null ? t('common.costUnknown') : <><span className="whitespace-nowrap">{f.money(BigInt(p.packPriceCents))}</span> {t('plans.pack', { size: new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(p.packSizeMilli / 1000), unit: plan.ingredient.unit })}</>;
    return <div className="space-y-1 text-sm"><p>{pack(plan.previousPrice)} → {pack(plan.proposedPrice)} · {locale === 'nl' ? 'excl. btw' : 'excl. VAT'}</p><p>{per(plan.previousPrice)} → {per(plan.proposedPrice)} · {locale === 'nl' ? 'excl. btw' : 'excl. VAT'}</p></div>;
  }
  async function confirm() {
    if (!choice || !client || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      await client[choice.action](choice.plan.id);
      // Existing document subscription reloads through beforeReplace/documentReplaced.
      // It defers replacement while any recipe or ingredient draft is open.
      setPlans(current => current.filter(p => p.id !== choice.plan.id));
      setDone(choice.action === 'apply' ? 'applied' : 'rejected'); setChoice(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'plan-stale' ? t('plans.stale') : code === 'plan-expired' ? t('plans.expired') : t('plans.error'));
    } finally { saving.current = false; setBusy(false); }
  }
  return <section data-testid="plans-panel" className="space-y-4 rounded-lg border-2 border-primary/50 bg-card p-4 sm:p-6" aria-labelledby="plans-title">
    <h2 ref={heading} tabIndex={-1} id="plans-title" className="text-xl font-semibold">{t(shown.some(p => p.status === 'pending') ? 'plans.title' : 'plans.recent')}</h2>
    {failed && <p role="alert">{t('plans.loadError')}</p>}
    {done && <p role="status">{t(done === 'applied' ? 'plans.applied' : 'plans.rejected')}</p>}
    {shown.map(plan => <article key={plan.id} className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{plan.ingredient.name}</h3><p className="text-sm text-muted-foreground">{t('plans.source')}</p>
      {(plan.status === 'stale' || plan.status === 'expired') && <p role="status" className="font-medium text-destructive">{t(plan.status === 'stale' ? 'plans.stale' : 'plans.expired')}</p>}
      <p className="text-sm text-muted-foreground">{t('terms.supplierHint')}</p>{prices(plan)}<Consequences plan={plan} />
      <p className="text-sm">{t('plans.expires', { date: new Date(plan.expiresAt).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB') })}</p>
      {plan.status === 'pending' && <div className="flex flex-wrap gap-2">{(['apply', 'reject'] as const).map(action => <Button key={action} variant={action === 'apply' ? 'default' : 'outline'} onClick={e => { trigger.current = e.currentTarget; setError(null); setChoice({ plan, action }); }}>{t(action === 'apply' ? 'plans.apply' : 'plans.reject')}</Button>)}</div>}
    </article>)}
    {choice && <Dialog open onOpenChange={open => { if (!open && !busy) setChoice(null); }}>
      <DialogContent role="alertdialog" className="max-h-[90svh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); (trigger.current?.isConnected ? trigger.current : heading.current)?.focus(); }}>
        <DialogHeader><DialogTitle>{t(choice.action === 'apply' ? 'plans.confirmApply' : 'plans.confirmReject')} · {choice.plan.ingredient.name}</DialogTitle>
          <DialogDescription>{t(choice.action === 'apply' ? 'plans.applyDescription' : 'plans.rejectDescription')}</DialogDescription></DialogHeader>
        {prices(choice.plan)}{choice.action === 'apply' && <Consequences plan={choice.plan} />}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setChoice(null)}>{t('common.cancel')}</Button>
          <Button disabled={busy} onClick={() => { void confirm(); }}>{t(choice.action === 'apply' ? 'plans.confirmApply' : 'plans.confirmReject')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </section>;
}
