import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { useCommands } from './DataProvider';
import { useLocale } from '@/ui/i18n';

/** Shared feedback for every durable command; duplicate prevention also lives in execute. */
export function CommandButton({ children, disabled, ...props }: ComponentProps<typeof Button>) {
  const { commandStatus } = useCommands();
  const { t } = useLocale();
  const saving = commandStatus === 'saving';
  return <Button {...props} disabled={disabled || saving} aria-busy={saving}>{saving ? t('commands.saving') : children}</Button>;
}
