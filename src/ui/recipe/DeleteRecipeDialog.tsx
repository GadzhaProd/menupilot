import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import type { Recipe } from '@/ui/domain/types';
import { recipesUsing } from '@/ui/forms/recipeForm';
import { hrefFor } from '@/ui/router/routes';

interface DeleteRecipeDialogProps {
  recipe: Recipe;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  /** Called after the recipe is gone; the page leaves the deleted recipe. */
  onDeleted: () => void;
}

/**
 * Confirm before deleting. A dish with saved scenarios says so and deletes them with it;
 * a prep that dishes still use is refused by the store, and the dialog says where it is used.
 */
export function DeleteRecipeDialog({ recipe, onClose, onCloseAutoFocus, onDeleted }: DeleteRecipeDialogProps) {
  const { execute } = useCommands();
  const document = useDocument();
  const [error, setError] = useState<string | null>(null);
  const scenarios = document.scenarios.filter((scenario) => scenario.recipeId === recipe.id);
  const users = error === null || recipe.kind !== 'prep' ? [] : recipesUsing(document, 'prep', recipe.id);
  const noun = recipe.kind === 'dish' ? 'dish' : 'prep';

  function confirm() {
    const result = execute(
      (store) => store.deleteRecipe(recipe.id, scenarios.length > 0 ? { deleteScenarios: true } : {}),
      { report: false },
    );
    if (result.ok) onDeleted();
    else setError(result.error);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Delete {recipe.name}?</DialogTitle>
          <DialogDescription>
            The {noun} and its lines are removed. This cannot be undone. Ingredients are not deleted.
          </DialogDescription>
        </DialogHeader>
        {scenarios.length > 0 ? (
          <div className="rounded-md border border-input bg-accent p-3 text-sm text-accent-foreground">
            <p className="font-medium">
              This dish has {scenarios.length} saved simulator {scenarios.length === 1 ? 'scenario' : 'scenarios'}. They will be deleted too:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {scenarios.map((scenario) => <li key={scenario.id}>{scenario.name}</li>)}
            </ul>
          </div>
        ) : null}
        {error !== null ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
        ) : null}
        {users.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">Remove it from these recipes first:</p>
            <ul className="mt-1 list-disc pl-5">
              {users.map((user) => (
                <li key={user.id}>
                  <a className="underline underline-offset-4" href={hrefFor({ name: 'recipe', id: user.id })}>{user.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={confirm}>
            {scenarios.length > 0 ? `Delete ${noun} and ${scenarios.length === 1 ? 'its scenario' : `${scenarios.length} scenarios`}` : `Delete ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
