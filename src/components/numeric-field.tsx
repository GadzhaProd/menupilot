import type { ComponentProps, ReactNode } from 'react';
import { FormField } from '@/components/form-field';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/ui/i18n';
interface NumericFieldProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode' | 'prefix'> {
  label: ReactNode; value: string; onValueChange(value: string): void;
  hint?: ReactNode; error?: string; prefix?: ReactNode;
}
/** String draft only: callers validate through existing form/core parsers on save. */
function NumericField({ label, value, onValueChange, hint, error, prefix, className, ...props }: NumericFieldProps) {
  return <FormField label={label} hint={hint} error={error}>{(control) => <div className="relative">
    {prefix && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{prefix}</span>}
    <Input {...props} {...control} type="text" inputMode="decimal" value={value} onChange={(event) => onValueChange(event.target.value)} className={cn('tabular-nums', prefix && 'pl-8', className)} />
  </div>}</FormField>;
}
/** Include incl./excl. VAT in label; supplier adds the required invoice hint. */
export function MoneyField({ supplier = false, hint, ...props }: Omit<NumericFieldProps, 'prefix'> & { supplier?: boolean }) {
  const { t } = useLocale();
  return <NumericField {...props} prefix="€" hint={hint ?? (supplier ? t('terms.supplierHint') : undefined)} />;
}
export function QuantityField({ unit, label, ...props }: Omit<NumericFieldProps, 'prefix'> & { unit: string }) {
  return <NumericField {...props} label={<>{label} ({unit})</>} />;
}
