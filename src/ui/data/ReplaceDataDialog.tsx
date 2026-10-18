import { useState } from 'react';
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
  onConfirm: () => string | null;
}

/** Confirm before all current data is replaced (import or reset). Cancel changes nothing. */
export function ReplaceDataDialog({
  title, description, confirmLabel, unsavedScenarios, onClose, onCloseAutoFocus, onConfirm,
}: ReplaceDataDialogProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>This replaces all current data. {description}</DialogDescription>
        </DialogHeader>
        {unsavedScenarios > 0 ? (
          <p className="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-950">
            You have {unsavedScenarios} unsaved simulator {unsavedScenarios === 1 ? 'scenario' : 'scenarios'}. They will be lost.
          </p>
        ) : null}
        {error !== null ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error} Your current data was not changed.
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={() => setError(onConfirm())}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
