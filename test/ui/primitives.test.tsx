import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MoneyField, QuantityField } from '@/components/numeric-field';
import { BeforeAfter, MoneyValue } from '@/components/ui/money-value';
import { LocaleProvider } from '@/ui/i18n';
import { memoryStorage } from './helpers';
import { InlineStatus } from '@/components/ui/inline-status';

it('links decimal drafts with labels, units, hints and persistent field errors', async () => {
  const change = vi.fn();
  render(<><MoneyField label="Supplier price" vat="excl" value="" onValueChange={change} error="Enter a price" supplier /><QuantityField label="Net quantity" unit="g" value="150" onValueChange={() => {}} /></>);
  const input = screen.getByRole('textbox', { name: 'Supplier price (excl. VAT)' });
  expect(input.getAttribute('inputmode')).toBe('decimal'); expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')?.split(' ').every((id) => document.getElementById(id))).toBe(true);
  await userEvent.type(input, '1'); expect(change).toHaveBeenCalledWith('1');
  expect(screen.getByRole('textbox', { name: 'Net quantity (g)' })).toBeTruthy();
});
it('money is already formatted, unknown is explicit, comparisons retain labels, status has semantics', () => {
  render(<><BeforeAfter before="€4.20" after="€4.85" /><MoneyValue value={null} /><InlineStatus tone="error">Could not save</InlineStatus></>);
  expect(screen.getByText('Before')).toBeTruthy(); expect(screen.getByText('Now')).toBeTruthy();
  expect(screen.getByText('cost unknown')).toBeTruthy(); expect(screen.getByRole('alert').textContent).toBe('Could not save');
});

it.each([
  ['en', 'incl', 'Price (incl. VAT)'],
  ['en', 'excl', 'Price (excl. VAT)'],
  ['nl', 'incl', 'Price (incl. btw)'],
  ['nl', 'excl', 'Price (excl. btw)'],
] as const)('MoneyField labels %s prices with %s VAT', (locale, vat, label) => {
  render(<LocaleProvider storage={memoryStorage({ 'menupilot.ui.locale.v1': locale })}>
    <MoneyField label="Price" vat={vat} value="12,50" onValueChange={() => {}} />
  </LocaleProvider>);
  expect(screen.getByRole('textbox', { name: label })).toBeTruthy();
});

// @ts-expect-error VAT context is mandatory, even for non-supplier prices.
const missingVat = <MoneyField label="Price" value="" onValueChange={() => {}} />;
void missingVat;
