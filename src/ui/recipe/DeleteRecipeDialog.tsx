import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import type { Recipe } from '@/ui/domain/types';
import { recipesUsing } from '@/ui/forms/recipeForm';
import { hrefFor } from '@/ui/router/routes';
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
  const { execute } = useCommands();
  const document = useDocument();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const scenarios = document.scenarios.filter((scenario) => scenario.recipeId === recipe.id);
  const users = error === null || recipe.kind !== 'prep' ? [] : recipesUsing(document, 'prep', recipe.id);
  const noun = recipe.kind === 'dish' ? t('recipe.dish') : t('recipe.prep');
  const deleteNoun = t(recipe.kind === 'dish' ? 'recipe.dishLower' : 'recipe.prepLower');

  function confirm() {
    const result = execute(
      (store) => store.deleteRecipe(recipe.id, scenarios.length > 0 ? { deleteScenarios: true } : {}),
      { report: false },
    );
    if (result.ok) onDeleted();
    else setError({ code: result.code, message: result.error });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{t('recipe.deleteNamed', { name: recipe.name })}</DialogTitle>
          <DialogDescription>{t('recipe.deleteDescription', { kind: noun })}</DialogDescription>
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
          <InlineStatus tone="error">{error.code === 'in-use' ? t('recipe.error.inUse') : locale === 'en' ? error.message : t('error.generic')}</InlineStatus>
        ) : null}
        {users.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">{t('recipe.removeUsersFirst')}</p>
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
          <DialogClose asChild><Button type="button" variant="outline">{t('common.cancel')}</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={confirm}>
            {scenarios.length > 0
              ? t(scenarios.length === 1 ? 'recipe.deleteScenariosOne' : 'recipe.deleteScenariosOther', { kind: deleteNoun, count: scenarios.length })
              : t('recipe.deleteKind', { kind: deleteNoun })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
