import { ArrowRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/ui/i18n';
export type MoneyTone = 'neutral' | 'positive' | 'negative';
const tones: Record<MoneyTone, string> = { neutral: 'text-foreground', positive: 'text-positive', negative: 'text-negative' };
/** Presentation only. Pass an exact formatted string from calc; null is unknown, never zero. */
export function MoneyValue({ value, tone = 'neutral', className, unknownLabel }: { value: string | null; tone?: MoneyTone; className?: string; unknownLabel?: string }) {
  const { t } = useLocale();
  return <span className={cn('money-value', value === null ? 'text-muted-foreground' : tones[tone], className)}>{value ?? unknownLabel ?? t('common.costUnknown')}</span>;
}
export function BeforeAfter({ before, after, beforeLabel, afterLabel, tone = 'neutral' }: { before: string | null; after: string | null; beforeLabel?: string; afterLabel?: string; tone?: MoneyTone }) {
  const { t } = useLocale();
  return <div className="flex flex-wrap items-end gap-4">
    <div><p className="text-xs text-muted-foreground">{beforeLabel ?? t('common.before')}</p><MoneyValue value={before} className="text-2xl" /></div>
    <ArrowRightIcon aria-hidden="true" className="mb-1 size-6 shrink-0 text-muted-foreground" />
    <div><p className="text-xs text-muted-foreground">{afterLabel ?? t('common.after')}</p><MoneyValue value={after} tone={tone} className="text-3xl" /></div>
  </div>;
}
