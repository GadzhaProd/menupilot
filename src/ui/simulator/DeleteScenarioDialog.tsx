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
  onConfirm: () => string | null;
}

/** Confirm before deleting a saved scenario. Recipes and prices are never touched. */
export function DeleteScenarioDialog({ name, onClose, onCloseAutoFocus, onConfirm }: DeleteScenarioDialogProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            Only this saved scenario is removed. Your recipes and ingredient prices are not changed.
          </DialogDescription>
        </DialogHeader>
        {error !== null ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={() => setError(onConfirm())}>Delete scenario</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
