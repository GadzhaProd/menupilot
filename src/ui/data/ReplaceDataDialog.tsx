import { useCommands } from '@/ui/data/DataProvider';
import { CommandButton } from '@/ui/data/CommandButton';
import { useState } from 'react';
import { useLocale } from '@/ui/i18n';
import { InlineStatus } from '@/components/ui/inline-status';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface ReplaceDataDialogProps {
  title: string;
  /** What will replace the current data, for example the file name. */
  description: string;
  confirmLabel: string;
  /** Unsaved simulator scenarios that the replacement will drop. */
  unsavedScenarios: number;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  /** Returns why the data could not be replaced, or null when it was. */
  onConfirm: () => Promise<string | null>;
}

/** Confirm before all current data is replaced (import or reset). Cancel changes nothing. */
export function ReplaceDataDialog({
  title, description, confirmLabel, unsavedScenarios, onClose, onCloseAutoFocus, onConfirm,
}: ReplaceDataDialogProps) {
  const { commandStatus } = useCommands();
  const { t, plural } = useLocale();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && commandStatus !== 'saving') onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('data.replacementWarning', { description })}</DialogDescription>
        </DialogHeader>
        {unsavedScenarios > 0 ? (
          <InlineStatus>{plural('data.unsavedScenarios', unsavedScenarios)}</InlineStatus>
        ) : null}
        {error !== null ? (
          <InlineStatus tone="error">{error}</InlineStatus>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button disabled={commandStatus === 'saving'} type="button" variant="outline">{t('data.cancel')}</Button></DialogClose>
          <CommandButton type="button" variant="destructive" onClick={async () => setError((await onConfirm()))}>{confirmLabel}</CommandButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
