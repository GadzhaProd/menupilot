import { useCommands } from '@/ui/data/DataProvider';
import { CommandButton } from '@/ui/data/CommandButton';
import { useState, type ReactNode } from 'react';
import { useLocale } from '@/ui/i18n';
import { InlineStatus } from '@/components/ui/inline-status';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ReplaceDataDialogProps {
  title: string;
  preview?: ReactNode;
  /** What will replace the current data, for example the file name. */
  description: string;
  confirmLabel: string;
  /** Unsaved simulator scenarios that the replacement will drop. */
  unsavedScenarios: number;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  /** Returns why the data could not be replaced, or null when it was. */
  onConfirm: () => Promise<{ message: string; details?: readonly string[] } | null>;
}

/** Confirm before all current data is replaced (import or reset). Cancel changes nothing. */
export function ReplaceDataDialog({
  title, description, preview, confirmLabel, unsavedScenarios, onClose, onCloseAutoFocus, onConfirm,
}: ReplaceDataDialogProps) {
  const { commandStatus } = useCommands();
  const { t, plural, locale } = useLocale();
  const [error, setError] = useState<{ message: string; details?: readonly string[] } | null>(null);
  const [errorLocale, setErrorLocale] = useState(locale);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && commandStatus !== 'saving') onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('data.replacementWarning', { description })}</DialogDescription>
        </DialogHeader>
        {preview}
        {unsavedScenarios > 0 ? (
          <InlineStatus>{plural('data.unsavedScenarios', unsavedScenarios)}</InlineStatus>
        ) : null}
        {error !== null && errorLocale === locale ? (
          <InlineStatus tone="error">
            <p>{error.message}</p>
            {error.details?.length ? <details className="mt-2 text-xs">
              <summary className="cursor-pointer">{t('data.importError.details')}</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words">{error.details.join('\n')}</pre>
            </details> : null}
          </InlineStatus>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button disabled={commandStatus === 'saving'} type="button" variant="outline">{t('data.cancel')}</Button></DialogClose>
          <CommandButton type="button" variant="destructive" onClick={async () => { setErrorLocale(locale); setError(await onConfirm()); }}>{confirmLabel}</CommandButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
