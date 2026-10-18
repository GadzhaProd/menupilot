import { useMemo, useRef, useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import { formatEURFromCents, packUnitPriceDisplay, selectPriceAtDate } from '@/ui/domain/calc';
import type { Ingredient } from '@/ui/domain/types';
import {
  validateName, validateNewIngredient, validatePrice, type IngredientDraft, type PriceDraft,
} from '@/ui/forms/ingredientForm';
import { formatQuantity, quantityToInput, type EnteredUnit } from '@/ui/forms/numbers';
import { recipesUsing } from '@/ui/forms/recipeForm';
import { useFocusFirstInvalid } from '@/ui/hooks/useFocusFirstInvalid';
import { hrefFor } from '@/ui/router/routes';
import { formatDate } from './format';
import { PriceFields } from './PriceFields';

interface DialogProps {
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

function SaveError({ message }: { message: string | null }) {
  return message === null ? null : (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>
  );
}

/* ---- Add ingredient ---- */

export function AddIngredientDialog({ onClose, onCloseAutoFocus }: DialogProps) {
  const { execute } = useCommands();
  const [draft, setDraft] = useState<IngredientDraft>({ name: '', packSize: '', packSizeUnit: 'kg', packPrice: '' });
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const checked = useMemo(() => validateNewIngredient(draft), [draft]);
  const errors = attempt > 0 && !checked.ok ? checked.errors : {};

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempt((count) => count + 1);
    if (!checked.ok) return;
    const result = execute((store) => store.addIngredient(checked.value), { report: false });
    if (result.ok) onClose();
    else setSaveError(result.error);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Add ingredient</DialogTitle>
          <DialogDescription>
            Enter the pack as you buy it. Leave size and price empty to add the price later; recipes will show “cost unknown” until then.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
          <FormField label="Name" error={errors.name}>
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Beef mince 80/20"
              />
            )}
          </FormField>
          <PriceFields draft={draft} onChange={(next) => setDraft({ ...draft, ...next })} errors={errors} base={null} />
          <SaveError message={saveError} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Add ingredient</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- New price ---- */

export function NewPriceDialog({ ingredient, onClose, onCloseAutoFocus }: DialogProps & { ingredient: Ingredient }) {
  const { execute } = useCommands();
  const current = selectPriceAtDate(ingredient.prices);
  const [draft, setDraft] = useState<PriceDraft>(() => {
    // Prices change more often than pack sizes: start from the last pack size.
    const size = current ? quantityToInput(current.packSizeMilli, ingredient.unit) : null;
    return { packSize: size?.text ?? '', packSizeUnit: size?.unit ?? defaultUnit(ingredient), packPrice: '' };
  });
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const checked = useMemo(() => validatePrice(draft, ingredient.unit), [draft, ingredient.unit]);
  const errors = attempt > 0 && !checked.ok ? checked.errors : {};

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempt((count) => count + 1);
    if (!checked.ok) return;
    const { packPriceCents, packSizeMilli } = checked.value;
    const result = execute((store) => store.addPrice(ingredient.id, { packPriceCents, packSizeMilli }), { report: false });
    if (result.ok) onClose();
    else setSaveError(result.error);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>New price: {ingredient.name}</DialogTitle>
          <DialogDescription>
            {current
              ? <>Now: {formatEURFromCents(current.packPriceCents)} excl. VAT for {formatQuantity(current.packSizeMilli, ingredient.unit)}. The old price stays in the history.</>
              : 'This ingredient has no price yet.'}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
          <PriceFields draft={draft} onChange={setDraft} errors={errors} base={ingredient.unit} />
          <SaveError message={saveError} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Save price</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The unit offered first when the ingredient has no pack size yet. */
function defaultUnit(ingredient: Ingredient): EnteredUnit {
  if (ingredient.unit === 'g') return 'kg';
  return ingredient.unit === 'ml' ? 'l' : 'pc';
}

/* ---- Price history ---- */

export function HistoryDialog({ ingredient, onCloseAutoFocus, onClose }: DialogProps & { ingredient: Ingredient }) {
  const newestFirst = [...ingredient.prices].reverse();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Price history: {ingredient.name}</DialogTitle>
          <DialogDescription>Prices are only ever added, never changed. All prices are excl. VAT.</DialogDescription>
        </DialogHeader>
        {newestFirst.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Pack</TableHead>
                <TableHead className="text-right">Pack price</TableHead>
                <TableHead className="text-right">Per kg, l or pc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newestFirst.map((price, index) => (
                <TableRow key={price.seq}>
                  <TableCell>
                    {formatDate(price.recordedAt)}
                    {index === 0 ? <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">current</span> : null}
                  </TableCell>
                  <TableCell className="text-right">{formatQuantity(price.packSizeMilli, ingredient.unit)}</TableCell>
                  <TableCell className="text-right">{formatEURFromCents(price.packPriceCents)}</TableCell>
                  <TableCell className="text-right">{packUnitPriceDisplay(price.packPriceCents, price.packSizeMilli, ingredient.unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <DialogClose asChild><Button type="button">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Rename ---- */

export function RenameDialog({ ingredient, onClose, onCloseAutoFocus }: DialogProps & { ingredient: Ingredient }) {
  const { execute } = useCommands();
  const [name, setName] = useState(ingredient.name);
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const checked = validateName(name);
  const error = attempt > 0 && !checked.ok ? checked.error : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempt((count) => count + 1);
    if (!checked.ok) return;
    const result = execute((store) => store.updateIngredient(ingredient.id, { name: checked.value }), { report: false });
    if (result.ok) onClose();
    else setSaveError(result.error);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Rename ingredient</DialogTitle>
          <DialogDescription>Recipes that use it keep working under the new name.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
          <FormField label="Name" error={error}>
            {(control) => <Input {...control} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />}
          </FormField>
          <SaveError message={saveError} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Delete ---- */

export function DeleteIngredientDialog({ ingredient, onClose, onCloseAutoFocus }: DialogProps & { ingredient: Ingredient }) {
  const { execute } = useCommands();
  const document = useDocument();
  const [saveError, setSaveError] = useState<string | null>(null);
  const users = saveError === null ? [] : recipesUsing(document, 'ingredient', ingredient.id);

  function confirm() {
    const result = execute((store) => store.deleteIngredient(ingredient.id), { report: false });
    if (result.ok) onClose();
    else setSaveError(result.error);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Delete {ingredient.name}?</DialogTitle>
          <DialogDescription>
            The ingredient and its price history are removed. This cannot be undone. An ingredient used in a recipe cannot be deleted.
          </DialogDescription>
        </DialogHeader>
        <SaveError message={saveError} />
        {users.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">Remove it from these recipes first:</p>
            <ul className="mt-1 list-disc pl-5">
              {users.map((recipe) => (
                <li key={recipe.id}>
                  <a className="underline underline-offset-4" href={hrefFor({ name: 'recipe', id: recipe.id })}>{recipe.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={confirm}>Delete ingredient</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
