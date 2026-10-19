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
import { selectPriceAtDate } from '@/ui/domain/calc';
import type { Ingredient } from '@/ui/domain/types';
import {
  validateName, validateNewIngredient, validatePrice, type IngredientDraft, type IngredientValidationCopy, type PriceDraft,
} from '@/ui/forms/ingredientForm';
import { formatQuantityLocale, quantityToInput, type EnteredUnit } from '@/ui/forms/numbers';
import { recipesUsing } from '@/ui/forms/recipeForm';
import { useFocusFirstInvalid } from '@/ui/hooks/useFocusFirstInvalid';
import { hrefFor } from '@/ui/router/routes';
import { PriceFields } from './PriceFields';
import { useLocale, useFormatters, type Translate } from '@/ui/i18n';

interface DialogProps {
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

function validationCopy(t: Translate): IngredientValidationCopy {
  return {
    nameEmpty: t('ingredients.error.name'), nameLong: t('ingredients.error.nameLong'), packSize: t('ingredients.error.packSize'),
    packPrice: t('ingredients.error.packPrice'), wrongUnit: (unit, units) => t('ingredients.error.unit', { unit: t(unit === 'g' ? 'units.g' : unit === 'ml' ? 'units.ml' : unit === 'pc' ? 'units.pc' : unit === 'kg' ? 'units.kg' : 'units.l'), units: units.map((entry) => t(entry === 'g' ? 'units.g' : entry === 'ml' ? 'units.ml' : entry === 'pc' ? 'units.pc' : entry === 'kg' ? 'units.kg' : 'units.l')).join(' of ') }),
  };
}

function SaveError({ message }: { message: string | null }) {
  const { t, locale } = useLocale();
  return message === null ? null : (
    <p role="alert" className="rounded-md border border-negative bg-surface p-3 text-sm text-negative">{locale === 'en' ? message : t('error.generic')}</p>
  );
}

/* ---- Add ingredient ---- */

export function AddIngredientDialog({ onClose, onCloseAutoFocus }: DialogProps) {
  const { t } = useLocale();
  const copy = useMemo(() => validationCopy(t), [t]);
  const { execute } = useCommands();
  const [draft, setDraft] = useState<IngredientDraft>({ name: '', packSize: '', packSizeUnit: 'kg', packPrice: '' });
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const checked = useMemo(() => validateNewIngredient(draft, copy), [draft, copy]);
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
          <DialogTitle>{t('ingredients.add')}</DialogTitle>
          <DialogDescription>{t('ingredients.addDescription')}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
          <FormField label={t('ingredients.name')} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={t('ingredients.namePlaceholder')}
              />
            )}
          </FormField>
          <PriceFields draft={draft} onChange={(next) => setDraft({ ...draft, ...next })} errors={errors} base={null} />
          <SaveError message={saveError} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">{t('ingredients.cancel')}</Button></DialogClose>
            <Button type="submit">{t('ingredients.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- New price ---- */

export function NewPriceDialog({ ingredient, onClose, onCloseAutoFocus }: DialogProps & { ingredient: Ingredient }) {
  const { t, locale } = useLocale();
  const f = useFormatters();
  const copy = useMemo(() => validationCopy(t), [t]);
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

  const checked = useMemo(() => validatePrice(draft, ingredient.unit, copy), [draft, ingredient.unit, copy]);
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
          <DialogTitle>{t('ingredients.newPriceFor', { name: ingredient.name })}</DialogTitle>
          <DialogDescription>
            {current
              ? t('ingredients.nowPrice', { price: f.money(current.packPriceCents), size: formatQuantityLocale(current.packSizeMilli, ingredient.unit, locale) })
              : t('ingredients.noPriceYet')}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
          <PriceFields draft={draft} onChange={setDraft} errors={errors} base={ingredient.unit} />
          <SaveError message={saveError} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">{t('ingredients.cancel')}</Button></DialogClose>
            <Button type="submit">{t('ingredients.savePrice')}</Button>
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
  const { t, locale } = useLocale();
  const f = useFormatters();
  const newestFirst = [...ingredient.prices].reverse();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('ingredients.historyFor', { name: ingredient.name })}</DialogTitle>
          <DialogDescription>{t('ingredients.historyDescription')}</DialogDescription>
        </DialogHeader>
        {newestFirst.length === 0 ? (
          <p className="text-muted-foreground">{t('ingredients.noPrices')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ingredients.date')}</TableHead>
                <TableHead className="text-right">{t('ingredients.pack')}</TableHead>
                <TableHead className="text-right">{t('ingredients.packPrice')}</TableHead>
                <TableHead className="text-right">{t('ingredients.perUnit')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newestFirst.map((price, index) => (
                <TableRow key={price.seq}>
                  <TableCell>
                    {f.date(price.recordedAt)}
                    {index === 0 ? <span className="ml-2 bg-panel px-1.5 py-0.5 text-sm">{t('ingredients.current')}</span> : null}
                  </TableCell>
                  <TableCell className="text-right">{formatQuantityLocale(price.packSizeMilli, ingredient.unit, locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.money(price.packPriceCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.packPrice(price.packPriceCents, price.packSizeMilli, ingredient.unit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <DialogClose asChild><Button type="button">{t('common.close')}</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Rename ---- */

export function RenameDialog({ ingredient, onClose, onCloseAutoFocus }: DialogProps & { ingredient: Ingredient }) {
  const { t } = useLocale();
  const copy = useMemo(() => validationCopy(t), [t]);
  const { execute } = useCommands();
  const [name, setName] = useState(ingredient.name);
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const checked = validateName(name, copy);
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
          <DialogTitle>{t('ingredients.rename')}</DialogTitle>
          <DialogDescription>{t('ingredients.renameDescription')}</DialogDescription>
        </DialogHeader>
        <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
          <FormField label={t('ingredients.name')} error={error}>
            {(control) => <Input {...control} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />}
          </FormField>
          <SaveError message={saveError} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">{t('ingredients.cancel')}</Button></DialogClose>
            <Button type="submit">{t('ingredients.rename')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Delete ---- */

export function DeleteIngredientDialog({ ingredient, onClose, onCloseAutoFocus }: DialogProps & { ingredient: Ingredient }) {
  const { t } = useLocale();
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
          <DialogTitle>{t('ingredients.deleteTitle', { name: ingredient.name })}</DialogTitle>
          <DialogDescription>{t('ingredients.deleteDescription')}</DialogDescription>
        </DialogHeader>
        <SaveError message={saveError} />
        {users.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">{t('ingredients.removeFromRecipes')}</p>
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
          <DialogClose asChild><Button type="button" variant="outline">{t('ingredients.cancel')}</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={confirm}>{t('ingredients.deleteConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
