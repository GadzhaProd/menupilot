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

function Warnings({ plan }: { plan: PricePlan }) {
  const { t } = useLocale();
  return plan.warnings?.length ? <div className="space-y-2 rounded border-2 border-amber-600 bg-amber-50 p-3 font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-50">
    {plan.warnings.map(w => <p key={w.code}>⚠ {t(w.code === 'zero-price' ? 'plans.zeroPrice' : 'plans.largeChange')}</p>)}
  </div> : null;
}

export function LocalPlans() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.('(max-width: 639px)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 639px)');
    if (!media) return;
    const change = () => setNarrow(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const pageSize = narrow ? 1 : 3;
  const local = useLocalMode(), { t, locale } = useLocale(), f = useFormatters();
  const client = useMemo(() => local?.token ? createHttpPlanAdapter(local.token) : null, [local?.token]);
  const [plans, setPlans] = useState<readonly PricePlan[]>([]);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState<{ plans: readonly PricePlan[]; action: 'apply' | 'reject' } | null>(null);
  const [busy, setBusy] = useState(false), saving = useRef(false);
  const [error, setError] = useState<string | null>(null), [done, setDone] = useState<'applied' | 'rejected' | null>(null);
  const [offset, setOffset] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => client?.subscribe(value => { setFailed(value === null); if (value) setPlans(value); }), [client]);
  useEffect(() => { if (done) { const timer = setTimeout(() => setDone(null), 5000); return () => clearTimeout(timer); } }, [done]);
  const pending = plans.filter(p => p.status === 'pending');
  const recent = plans.filter(p => ['stale', 'expired', 'superseded', 'rejected'].includes(p.status));
  const start = offset < pending.length ? offset : 0;
  const shown = pending.slice(start, start + pageSize);
  if (!local || !client) return null;
  if (!pending.length && !recent.length && !failed && !done && !choice) return null;
  const per = (p: PlanPackaging | null) => p === null ? t('common.costUnknown') : <span className="whitespace-nowrap">{f.money(BigInt(p.unitPrice.cents))}/{p.unitPrice.per}</span>;
  function prices(plan: PricePlan) {
    const pack = (p: PlanPackaging | null) => p === null ? t('common.costUnknown') : <><span className="whitespace-nowrap">{f.money(BigInt(p.packPriceCents))}</span> {t('plans.pack', { size: new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(p.packSizeMilli / 1000), unit: plan.ingredient.unit })}</>;
    return <div className="space-y-1 text-sm"><p>{pack(plan.previousPrice)} → {pack(plan.proposedPrice)} · {t('common.exclVat')}</p><p>{per(plan.previousPrice)} → {per(plan.proposedPrice)} · {t('common.exclVat')}</p></div>;
  }
  function choose(button: HTMLButtonElement, selected: readonly PricePlan[], action: 'apply' | 'reject') {
    trigger.current = button; setDone(null); setError(null); setChoice({ plans: selected, action });
  }
  async function confirm() {
    if (!choice || !client || saving.current) return;
    saving.current = true; setBusy(true); setError(null); setDone(null);
    try {
      // Each rejection is idempotent; a failed bulk action can safely be retried.
      const results = await Promise.allSettled(choice.plans.map(p => client[choice.action](p.id)));
      const success = choice.plans.filter((_, i) => results[i]?.status === 'fulfilled').map(p => p.id);
      // The existing document subscription preserves drafts and dispatches documentReplaced.
      setPlans(current => current.map(p => success.includes(p.id) ? { ...p, status: choice.action === 'apply' ? 'applied' : 'rejected' } : p));
      const failure = results.find(r => r.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      setDone(choice.action === 'apply' ? 'applied' : 'rejected'); setChoice(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'plan-stale' ? t('plans.stale') : code === 'plan-expired' ? t('plans.expired') : t('plans.error'));
    } finally { saving.current = false; setBusy(false); }
  }
  return <section data-testid="plans-panel" className="space-y-4 rounded-lg border-2 border-primary/50 bg-card p-4 sm:p-6" aria-labelledby="plans-title">
    <h2 ref={heading} tabIndex={-1} id="plans-title" className="text-xl font-semibold">{t(pending.length ? 'plans.title' : 'plans.recent')}</h2>
    <p role="status" className={done ? '' : 'sr-only'}>{done ? t(done === 'applied' ? 'plans.applied' : 'plans.rejected') : t('plans.pendingCount', { count: pending.length })}</p>
    {failed && <p role="alert">{t('plans.loadError')}</p>}
    {recent.length > 0 && <details className="border-t pt-3 text-sm">
      <summary className="cursor-pointer font-medium">{t('plans.inactiveList', { count: recent.length })}</summary>
      <ul className="mt-3 space-y-3">{recent.map(plan => <li key={plan.id} className="border-l-2 pl-3">
        <p className="font-medium">{plan.ingredient.name}</p>
        <p className="text-muted-foreground">{t(plan.status === 'stale' ? 'plans.reasonStale' : plan.status === 'expired' ? 'plans.reasonExpired' : plan.status === 'rejected' ? 'plans.reasonRejected' : 'plans.reasonSuperseded')}</p>
      </li>)}</ul>
      <p className="mt-3 text-muted-foreground">{t('plans.askAgain')}</p>
    </details>}
    {pending.length >= 2 && <Button variant="outline" onClick={e => choose(e.currentTarget, pending, 'reject')}>{t('plans.rejectAll')}</Button>}
    {shown.map(plan => <article key={plan.id} className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{plan.ingredient.name}</h3><p className="text-sm text-muted-foreground">{t('plans.source')}</p>
      <Warnings plan={plan} />
      <p className="text-sm text-muted-foreground">{t('terms.supplierHint')}</p>{prices(plan)}<Consequences plan={plan} />
      <p className="text-sm">{t('plans.expires', { date: new Date(plan.expiresAt).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB') })}</p>
      <div className="flex flex-wrap gap-2">{(['apply', 'reject'] as const).map(action => <Button key={action} variant={action === 'apply' ? 'default' : 'outline'} onClick={e => choose(e.currentTarget, [plan], action)}>{t(action === 'apply' ? 'plans.apply' : 'plans.reject')}</Button>)}</div>
    </article>)}
    <div className="flex flex-wrap gap-2">
      {start > 0 && <Button variant="outline" onClick={() => { setDone(null); setOffset(0); }}>{t('plans.first')}</Button>}
      {pending.length > start + pageSize && <Button variant="outline" onClick={() => { setDone(null); setOffset(start + pageSize); }}>{t('plans.more', { count: pending.length - start - pageSize })}</Button>}
    </div>
    {choice && <Dialog open onOpenChange={open => { if (!open && !busy) setChoice(null); }}>
      <DialogContent role="alertdialog" className="max-h-[90svh] overflow-y-auto" onCloseAutoFocus={event => { event.preventDefault(); (trigger.current?.isConnected ? trigger.current : heading.current)?.focus(); }}>
        <DialogHeader><DialogTitle>{t(choice.action === 'apply' ? 'plans.confirmApply' : 'plans.confirmReject')} · {choice.plans.length === 1 ? choice.plans[0]!.ingredient.name : t('plans.selected', { count: choice.plans.length })}</DialogTitle>
          <DialogDescription>{t(choice.action === 'apply' ? 'plans.applyDescription' : 'plans.rejectDescription')}</DialogDescription></DialogHeader>
        {choice.plans.length === 1 ? <>{prices(choice.plans[0]!)}<Warnings plan={choice.plans[0]!} />{choice.action === 'apply' && <Consequences plan={choice.plans[0]!} />}</> : <ul>{choice.plans.map(p => <li key={p.id}>{p.ingredient.name}</li>)}</ul>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setChoice(null)}>{t('common.cancel')}</Button>
          <Button disabled={busy} onClick={() => { void confirm(); }}>{t(choice.action === 'apply' ? 'plans.confirmApply' : 'plans.confirmReject')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </section>;
}
