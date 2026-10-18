import { describe, expect, it } from 'vitest';
import demo from '../../data/demo.json';
import { dashboardData } from '@/ui/domain/dashboard';

const demoData = demo as never;

describe('dashboard domain adapter', () => {
  it('shows the Classic Burger cost increase and monthly impact at 30 days', () => {
    const result = dashboardData(demoData, '2026-09-18T23:59:59.999Z');
    const burger = result.dishes.find((row) => row.name === 'Classic Burger');

    expect(burger?.comparisonCostMicro).toBe(4_200_000n);
    expect(burger?.currentCostMicro).toBe(4_850_000n);
    expect(burger?.monthlyImpactCents).toBe(-19_500n);
  });

  it('shows no cost or monthly changes at 7 days and a zero menu total', () => {
    const result = dashboardData(demoData, '2026-10-11T23:59:59.999Z');
    const burger = result.dishes.find((row) => row.name === 'Classic Burger');

    expect(burger?.costDeltaMicro).toBe(0n);
    expect(burger?.monthlyImpactCents).toBe(0n);
    expect(result.totalMonthlyImpactCents).toBe(0n);
  });

  it('keeps the menu impact unknown when no comparison-date prices exist', () => {
    const result = dashboardData(demoData, '2026-07-20T23:59:59.999Z');

    expect(result.dishes.every((row) => row.status === 'no-price-on-date')).toBe(true);
    expect(result.totalMonthlyImpactCents).toBeNull();
  });

  it('excludes dishes without a volume and totals only the other monthly impacts', () => {
    const result = dashboardData(demoData, '2026-09-18T23:59:59.999Z');
    const soup = result.dishes.find((row) => row.name === 'Tomato Soup');
    const included = result.dishes.filter((row) => row.monthlyVolume !== null);
    const expectedTotal = included.reduce(
      (sum, row) => sum + (row.monthlyImpactCents ?? 0n),
      0n,
    );

    expect(soup?.monthlyImpactCents).toBeNull();
    expect(result.excludedWithoutVolume).toBe(1);
    expect(result.totalMonthlyImpactCents).toBe(expectedTotal);
  });

  it('marks ingredients with no price on the selected date without treating them as zero', () => {
    const data = structuredClone(demo) as typeof demo;
    const beef = data.ingredients.find((ingredient) => ingredient.id === 'ing_beef');
    if (beef) beef.prices = beef.prices.slice(-1);

    const result = dashboardData(data as never, '2026-09-18T23:59:59.999Z');
    const burger = result.dishes.find((row) => row.name === 'Classic Burger');

    expect(burger?.status).toBe('no-price-on-date');
    expect(burger?.comparisonCostMicro).toBeNull();
    expect(burger?.costDeltaMicro).toBeNull();
    expect(burger?.monthlyImpactCents).toBeNull();
  });

  it('provides prep unit costs for kg, l and pc at current and comparison prices', () => {
    const data = structuredClone(demo) as typeof demo;
    const historicalPrices = [
      {
        seq: 1,
        recordedAt: '2026-08-01T12:00:00.000Z',
        packPriceCents: 100,
        packSizeMilli: 1_000_000,
      },
      {
        seq: 2,
        recordedAt: '2026-10-01T12:00:00.000Z',
        packPriceCents: 200,
        packSizeMilli: 1_000_000,
      },
    ];
    data.ingredients.push(
      { id: 'water', name: 'Water', unit: 'ml', prices: historicalPrices },
      { id: 'spoon', name: 'Spoon', unit: 'pc', prices: historicalPrices },
    );
    data.recipes.push(
      {
        id: 'prep-liquid', name: 'Liquid prep', kind: 'prep',
        outputMilli: 1_000_000, outputUnit: 'ml',
        lines: [{
          id: 'line-liquid',
          ref: { kind: 'ingredient', id: 'water' },
          netQtyMilli: 1_000_000,
          yieldBp: 10_000,
        }],
      },
      {
        id: 'prep-piece', name: 'Piece prep', kind: 'prep',
        outputMilli: 1_000, outputUnit: 'pc',
        lines: [{
          id: 'line-piece',
          ref: { kind: 'ingredient', id: 'spoon' },
          netQtyMilli: 1_000,
          yieldBp: 10_000,
        }],
      },
    );

    const result = dashboardData(data as never, '2026-09-18T23:59:59.999Z');
    const liquid = result.preps.find((row) => row.id === 'prep-liquid');
    const piece = result.preps.find((row) => row.id === 'prep-piece');
    const base = result.preps.find((row) => row.name === 'Tomato base');

    expect(base?.current).toContain('/kg');
    expect(base?.comparison).toContain('/kg');
    expect(liquid?.current).toContain('/l');
    expect(liquid?.comparison).toContain('/l');
    expect(piece?.current).toContain('/pc');
    expect(piece?.comparison).toContain('/pc');
    expect(liquid?.current).not.toBe(liquid?.comparison);
  });

  it('counts exactly the demo dishes whose recipe cost increased over 30 days', () => {
    const result = dashboardData(demoData, '2026-09-18T23:59:59.999Z');
    const increased = result.dishes.filter(
      (row) => row.costDeltaMicro !== null && row.costDeltaMicro > 0n,
    );

    expect(increased.map((row) => row.name)).toEqual([
      'Classic Burger',
      'Crispy Chicken Burger',
      'Fries with Burger Sauce',
      'Tomato Soup',
      'House Red Wine (glass)',
    ]);
    expect(result.gotMoreExpensive).toBe(increased.length);
  });
});
