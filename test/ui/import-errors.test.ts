import { expect, it } from 'vitest';
import { createTranslator } from '@/ui/i18n/messages';
import { localizedImportError } from '@/ui/data/importErrors';

const raw = JSON.stringify({ ingredients: [{ name: 'Melk' }], recipes: [{ name: 'Super gran ragù' }] });
it.each(['en', 'nl'] as const)('localizes named import errors (%s)', locale => {
  const t = createTranslator(locale);
  expect(localizedImportError(t, 'invalid', ['ingredients[0].prices[0].packPriceCents: must be an integer of at least 0'], raw)).toMatch(/Melk/);
  expect(localizedImportError(t, 'invalid', ['recipes[0]: prep nesting depth is 6; the maximum is 5'], raw)).toMatch(/Super gran ragù/);
  expect(localizedImportError(t, 'invalid', ['recipes[0]: prep cycle Prep A -> Prep B -> Prep A'], raw)).toMatch(/Prep A/);
  expect(localizedImportError(t, 'invalid', ["recipes[0].lines[0].ref.id: unknown ingredient 'missing'"], raw)).toMatch(/Super gran ragù/);
  expect(localizedImportError(t, 'corrupt-json', [], '{')).toMatch(/JSON/);
});
