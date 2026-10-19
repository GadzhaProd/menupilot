import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createRichTranslator, LocaleProvider, useLocale } from '@/ui/i18n';
import { memoryStorage } from './helpers';

it.each(['en', 'nl'] as const)('rich %s messages preserve translated order and never parse user markup', (locale) => {
  function Message() {
    const { tRich } = useLocale();
    return <p data-testid="message">{tRich('common.deleteNamed', { name: '<img src=x> Soup' }, { b: children => <strong>{children}</strong> })}</p>;
  }
  render(<LocaleProvider storage={memoryStorage({ 'menupilot.ui.locale.v1': locale })}><Message /></LocaleProvider>);
  const message = screen.getByTestId('message');
  expect(message.textContent).toBe(locale === 'en' ? 'Delete <img src=x> Soup?' : '<img src=x> Soup verwijderen?');
  expect(message.querySelector('strong')?.textContent).toBe('<img src=x> Soup');
  expect(message.querySelector('img')).toBeNull();
});
it('rich keys require their parameters and declared component callbacks', () => {
  const rich = createRichTranslator('en');
  // @ts-expect-error the b component is required by this dictionary entry
  expect(() => rich('common.deleteNamed', { name: 'Soup' }, {})).toThrow(/component/);
  // @ts-expect-error name is required
  expect(() => rich('common.deleteNamed', {}, { b: children => <b>{children}</b> })).toThrow(/parameter/);
  render(<>{rich('common.save', {}, {})}</>);
  expect(screen.getByText('Save')).toBeTruthy();
});
