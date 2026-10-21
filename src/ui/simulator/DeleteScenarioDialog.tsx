import { useCommands } from '@/ui/data/DataProvider';
import { CommandButton } from '@/ui/data/CommandButton';
import { useLocale } from '@/ui/i18n';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface DeleteScenarioDialogProps {
  name: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  /** Returns why the scenario could not be deleted, or null when it is gone. */
  onConfirm: () => Promise<string | null>;
}

/** Confirm before deleting a saved scenario. Recipes and prices are never touched. */
export function DeleteScenarioDialog({ name, onClose, onCloseAutoFocus, onConfirm }: DeleteScenarioDialogProps) {
  const { commandStatus } = useCommands();
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && commandStatus !== 'saving') onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('simulator.deleteTitle', { name })}</DialogTitle>
          <DialogDescription>
            {t('simulator.deleteHint')}
          </DialogDescription>
        </DialogHeader>
        {error !== null ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button disabled={commandStatus === 'saving'} type="button" variant="outline">{t('simulator.cancel')}</Button></DialogClose>
          <CommandButton type="button" variant="destructive" onClick={async () => setError((await onConfirm()))}>{t('simulator.deleteConfirm')}</CommandButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
