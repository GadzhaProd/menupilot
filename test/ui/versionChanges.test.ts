import { expect, it } from 'vitest';
import { describeVersionChanges } from '@/ui/data/versionChanges';
import { summarizeVersionChanges } from '@/ui/data/versionChanges';
import { createTranslator, plural } from '@/ui/i18n/messages';
import { demoCopy } from './helpers';
import type { MenuDocument } from '@/ui/domain/types';

it('names changed, added, and removed entries with their entity kind', () => {
  const before = demoCopy();
  const after = demoCopy();
  const dish = after.recipes.find(recipe => recipe.kind === 'dish')!;
  dish.name = 'Updated dish';
  after.ingredients[0]!.prices[0]!.packPriceCents++;
  after.ingredients.push({ ...after.ingredients[0]!, id: 'new-ing', name: 'New ingredient' });
  expect(describeVersionChanges(before as MenuDocument, after as MenuDocument)).toEqual(expect.arrayContaining([
    { name: 'Updated dish', kind: 'dish' }, { name: before.ingredients[0]!.name, kind: 'ingredient' }, { name: 'New ingredient', kind: 'ingredient' },
  ]));
});

it('describes an appended ingredient price as a new price', () => {
  const before = demoCopy() as MenuDocument;
  const after: any = demoCopy();
  const ingredient = after.ingredients[0]!;
  ingredient.prices.push({ ...ingredient.prices.at(-1)!, seq: ingredient.prices.at(-1)!.seq + 1, recordedAt: '2026-10-19T12:00:00.000Z' });
  expect(describeVersionChanges(before, after)).toContainEqual({ name: ingredient.name, kind: 'newPrice' });
});

it('summarizes three named changes and pluralizes the remainder in English and Dutch', () => {
  const changes = [1, 2, 3, 4].map(index => ({ name: `Item ${index}`, kind: 'ingredient' as const }));
  for (const locale of ['en', 'nl'] as const) {
    const t = createTranslator(locale);
    const summary = summarizeVersionChanges(changes, {
      dish: t('history.kind.dish'), prep: t('history.kind.prep'), ingredient: t('history.kind.ingredient'), newPrice: t('history.kind.newPrice'), scenario: t('history.kind.scenario'), settings: t('history.kind.settings'),
    }, count => plural(locale, 'history.more', count), t('history.settingsName'));
    expect(summary.split(',')).toHaveLength(4);
    expect(summary).toContain(locale === 'nl' ? 'en 1 andere wijziging' : 'and 1 more change');
    expect(summary).not.toContain('Item 4');
  }
});

it('names settings changes instead of describing them as unchanged', () => {
  const before = demoCopy() as MenuDocument;
  const after = { ...before, settings: { ...before.settings, defaultVatRateBp: before.settings.defaultVatRateBp + 1 } } as MenuDocument;
  expect(describeVersionChanges(before, after)).toContainEqual({ name: '', kind: 'settings' });
  for (const locale of ['en', 'nl'] as const) {
    const t = createTranslator(locale);
    expect(summarizeVersionChanges(describeVersionChanges(before, after), {
      dish: t('history.kind.dish'), prep: t('history.kind.prep'), ingredient: t('history.kind.ingredient'), newPrice: t('history.kind.newPrice'), scenario: t('history.kind.scenario'), settings: t('history.kind.settings'),
    }, count => plural(locale, 'history.more', count), t('history.settingsName'))).toBe(locale === 'nl' ? 'Instellingen' : 'Settings');
  }
});
