import { describe, expect, it } from 'vitest';
import { dateDaysAgo } from '@/ui/pages/DashboardPage';

describe('dashboard date calculations use the injected clock', () => {
  it.each([
    ['today', '2026-11-05T12:00:00.000Z', 0, '2026-11-05'],
    ['30 days ahead', '2026-12-05T12:00:00.000Z', 30, '2026-11-05'],
    ['400 days ahead', '2027-12-10T12:00:00.000Z', 400, '2026-11-05'],
    ['month end', '2027-01-31T12:00:00.000Z', 30, '2027-01-01'],
    ['year end', '2027-12-31T12:00:00.000Z', 30, '2027-12-01'],
  ])('computes the comparison date at %s', (_label, instant, days, expected) => {
    expect(dateDaysAgo(days, new Date(instant))).toBe(expected);
  });
});
