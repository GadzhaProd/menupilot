import { expect, it } from 'vitest';
import { localizedImportError } from '@/ui/data/importErrors';
import { parseBackup } from '@/store/serialization.js';
import { createTranslator } from '@/ui/i18n/messages';
import { demoCopy } from './helpers';

function failImport(document: any, version: 'v1' | 'v2') {
  const raw = version === 'v1' ? JSON.stringify(document) : JSON.stringify({
    version: 2, schemaVersion: 2, documentId: 'backup', revision: 1, document,
  });
  try { parseBackup(raw); } catch (error: any) { return error; }
  throw new Error('Expected invalid backup');
}

function invalidDocuments() {
  const price: any = demoCopy();
  price.ingredients[0]!.prices[0]!.packPriceCents = -1;

  const depth: any = demoCopy();
  const prepTemplate = structuredClone(depth.recipes.find((recipe: any) => recipe.kind === 'prep')!);
  const chain = Array.from({ length: 6 }, (_, index) => ({ ...structuredClone(prepTemplate), id: `chain-${index}`, name: `Prep ${index + 1}` }));
  chain.forEach((recipe, index) => {
    if (index < chain.length - 1) recipe.lines = [{ ...recipe.lines[0]!, id: `chain-line-${index}`, ref: { kind: 'prep', id: chain[index + 1]!.id } }];
  });
  depth.recipes.push(...chain);

  const unknown: any = demoCopy();
  const dish = unknown.recipes.find((recipe: any) => recipe.kind === 'dish')!;
  dish.lines[0]!.ref = { kind: 'ingredient', id: 'missing-ingredient' };

  const cycle: any = demoCopy();
  cycle.recipes.push(
    { ...structuredClone(prepTemplate), id: 'cycle-a', name: 'Prep A', lines: [{ ...prepTemplate.lines[0]!, id: 'cycle-line-a', ref: { kind: 'prep', id: 'cycle-b' } }] },
    { ...structuredClone(prepTemplate), id: 'cycle-b', name: 'Prep B', lines: [{ ...prepTemplate.lines[0]!, id: 'cycle-line-b', ref: { kind: 'prep', id: 'cycle-a' } }] },
  );
  return { price, depth, unknown, cycle };
}

it.each(['v1', 'v2'] as const)('localizes import validation from %s envelopes in English and Dutch', version => {
  const documents = invalidDocuments();
  for (const locale of ['en', 'nl'] as const) {
    const t = createTranslator(locale);
    const price = failImport(documents.price, version);
    expect(localizedImportError(t, price.code, price.details, price.structuredDetails)).toBe(locale === 'en'
      ? `Ingredient “${documents.price.ingredients[0]!.name}”: price must not be negative.`
      : `Ingrediënt “${documents.price.ingredients[0]!.name}”: de prijs mag niet negatief zijn.`);

    const depth = failImport(documents.depth, version);
    expect(localizedImportError(t, depth.code, depth.details, depth.structuredDetails)).toBe(locale === 'en'
      ? 'Prep “Prep 1”: preps can be nested at most 5 levels deep.'
      : 'Basisrecept “Prep 1”: basisrecepten mogen maximaal 5 niveaus diep zijn.');

    const unknown = failImport(documents.unknown, version);
    expect(localizedImportError(t, unknown.code, unknown.details, unknown.structuredDetails)).toBe(locale === 'en'
      ? `Recipe “${documents.unknown.recipes.find((recipe: any) => recipe.kind === 'dish')!.name}” refers to an unknown ingredient “missing-ingredient”.`
      : `Recept “${documents.unknown.recipes.find((recipe: any) => recipe.kind === 'dish')!.name}” verwijst naar een onbekend ingrediënt “missing-ingredient”.`);

    const cycle = failImport(documents.cycle, version);
    expect(localizedImportError(t, cycle.code, cycle.details, cycle.structuredDetails)).toBe(locale === 'en'
      ? 'These preps form a loop: Prep A → Prep B → Prep A.'
      : 'Deze basisrecepten vormen een lus: Prep A → Prep B → Prep A.');
    expect(localizedImportError(t, 'corrupt-json', [], [])).toMatch(/JSON|JSON/i);
  }
});

it('attaches structured validation details while preserving legacy error details', () => {
  const document: any = demoCopy();
  document.ingredients[0]!.prices[0]!.packPriceCents = -1;
  const error = failImport(document, 'v2');
  expect(error.details[0]).toMatch(/packPriceCents: must be an integer of at least 0/);
  expect(error.structuredDetails[0]).toMatchObject({ code: 'negative-price', entityKind: 'ingredient', entityName: document.ingredients[0]!.name });
});
