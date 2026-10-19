import { describe, expect, it } from 'vitest';
import { formatPercentTenths, formatPoints } from '@/ui/dashboard/format';

describe('dashboard point formatting', () => {
  it.each([
    [-5n, '-0.5 pp'],
    [-1n, '-0.1 pp'],
    [-15n, '-1.5 pp'],
    [0n, '0.0 pp'],
    [5n, '+0.5 pp'],
  ])('formats %s with its sign', (value, expected) => {
    expect(formatPoints(value)).toBe(expected);
  });

  it('retains the minus sign for small percentages', () => {
    expect(formatPercentTenths(-5n)).toBe('-0.5%');
  });
});
