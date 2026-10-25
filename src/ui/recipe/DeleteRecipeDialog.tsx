import { CommandButton } from '@/ui/data/CommandButton';
import { isSafetyError } from '@/ui/data/safetyErrors';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import type { Recipe } from '@/ui/domain/types';
import { recipesUsing } from '@/ui/forms/recipeForm';
import { usedByText } from '@/ui/forms/usage';
import { UsedByList } from '@/ui/ingredients/UsedByList';
import { useLocale } from '@/ui/i18n';
import { InlineStatus } from '@/components/ui/inline-status';

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
  const { t, locale, plural } = useLocale();
  const { execute, commandStatus } = useCommands();
  const document = useDocument();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const scenarios = document.scenarios.filter((scenario) => scenario.recipeId === recipe.id);
  const users = recipe.kind !== 'prep' ? [] : recipesUsing(document, 'prep', recipe.id);

  async function confirm() {
    const result = (await execute(
      (store) => store.deleteRecipe(recipe.id, scenarios.length > 0 ? { deleteScenarios: true } : {}),
      { report: false, clearRecipeDraftKey: recipe.id },
    ));
    if (result.ok) onDeleted();
    else setError(isSafetyError(result.code) ? null : { code: result.code, message: result.error });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && commandStatus !== 'saving') onClose(); }}>
      <DialogContent data-draft-kind="recipe" data-draft-id={recipe.id} role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('recipe.deleteNamed', { name: recipe.name })}</DialogTitle>
          <DialogDescription>{t(recipe.kind === 'dish' ? 'prices.deleteDishDescription' : 'prices.deletePrepDescription')}</DialogDescription>
        </DialogHeader>
        {scenarios.length > 0 ? (
          <div className="border-y border-line bg-panel p-4">
            <p className="font-medium">{plural('recipe.savedScenarioCount', scenarios.length)}</p>
            <ul className="mt-1 list-disc pl-5">
              {scenarios.map((scenario) => <li key={scenario.id}>{scenario.name}</li>)}
            </ul>
          </div>
        ) : null}
        {error !== null ? (
          <InlineStatus tone="error">{error.code === 'in-use'
            ? [t('recipe.error.inUse'), users.length > 0 ? t('prices.usedBy', { names: usedByText(users.map((user) => user.name), t) }) : ''].filter(Boolean).join(' ')
            : locale === 'en' ? error.message : t('error.generic')}</InlineStatus>
        ) : null}
        {users.length > 0 ? (
          <div className="text-sm">
            <p>{t('prices.prepInUseNow')}</p>
            <p className="mt-2 font-medium">{t('recipe.removeUsersFirst')}</p>
            <UsedByList users={users} />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button disabled={commandStatus === 'saving'} type="button" variant="outline">{t('common.cancel')}</Button></DialogClose>
          <CommandButton type="button" variant="destructive" onClick={confirm}>
            {scenarios.length > 0 && recipe.kind === 'dish'
              ? t(scenarios.length === 1 ? 'recipe.deleteDishScenariosOne' : 'recipe.deleteDishScenariosOther', { count: scenarios.length })
              : t(recipe.kind === 'dish' ? 'recipe.deleteDish' : 'recipe.deletePrep')}
          </CommandButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
