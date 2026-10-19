import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/ui/i18n';
export function ComparisonPicker({ comparisonDate, quickDays, onPreset, onDateChange }: {
  comparisonDate: string; quickDays: string; onPreset(days: number): void; onDateChange(date: string): void;
}) {
  const { t } = useLocale();
  return <div className="flex flex-wrap items-center gap-3 border-y border-line py-4 no-print">
    <span className="font-semibold">{t('dashboard.compare')}</span>
    <div className="flex gap-2">{[7, 30, 90].map((days) =>
      <Button key={days} variant="outline" aria-pressed={quickDays === String(days)} className={quickDays === String(days) ? 'border-current bg-accent text-accent-foreground' : ''} onClick={() => onPreset(days)}>{t('dashboard.days', { count: days })}</Button>)}
    </div>
    <label className="flex flex-wrap items-center gap-2 text-sm">{t('dashboard.chooseDate')}
      <Input type="date" min="1000-01-01" max={new Date().toISOString().slice(0, 10)} value={comparisonDate} onChange={(event) => onDateChange(event.target.value)} className="w-auto max-w-full" />
    </label>
    <span className="text-xs text-muted-foreground">{t('dashboard.utc')}</span>
  </div>;
}
