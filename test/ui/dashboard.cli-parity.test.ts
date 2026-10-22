import { describe, expect, it } from 'vitest';
import enSource from '../../data/demo.json';
import nlSource from '../../data/demo.nl.json';
import { dashboardData } from '../../src/ui/domain/dashboard';
// @ts-expect-error JS demo utility is exercised by this integration test.
import { shiftDemoDates } from '../../src/store/demo.js';
// @ts-expect-error JS calc formatters are shared with the CLI and have no TS declarations.
import { formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale } from '../../src/calc/money.js';
// @ts-expect-error JS CLI module is exercised as an integration boundary.
import { dashboardDateDaysAgo, executeReadCommand } from '../../server/cliRead.js';

describe('CLI Dashboard parity', () => {
  it('matches UI rows, totals, exclusions and locale display around price changes and Nd windows', async () => {
    let scenarios = 0;
    for (const source of [enSource, nlSource]) {
      const locale = source === nlSource ? 'nl' : 'en';
      const today = new Date(); today.setUTCHours(12, 0, 0, 0);
      const doc = shiftDemoDates(structuredClone(source), today.toISOString()) as typeof source;
      const beef = doc.ingredients.find(ingredient => ingredient.id === 'ing_beef')!;
      const changeDate = beef.prices.at(-1)!.recordedAt.slice(0, 10);
      const dates = [
        new Date(Date.parse(`${changeDate}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10),
        changeDate,
        new Date(Date.parse(`${changeDate}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10),
        dashboardDateDaysAgo(30),
      ];
      for (let index = 0; index < 35; index++) {
        const offset = index * 86_400_000;
        const scenarioDoc = structuredClone(doc) as typeof source;
        if (index === 1) scenarioDoc.recipes.find((recipe) => recipe.kind === 'dish')!.monthlyVolume = 0;
        if (index === 2) scenarioDoc.recipes.find((recipe) => recipe.kind === 'dish')!.menuPriceInclVatCents = 0;
        if (index === 3) scenarioDoc.ingredients[0]!.prices = [];
        const date = dates[index] ?? new Date(today.getTime() - offset).toISOString().slice(0, 10);
        const asOf = `${date}T23:59:59.999Z`;
        const ui = dashboardData(scenarioDoc as never, asOf);
        const since = index === 3 ? '30d' : date;
        const cli = await executeReadCommand('what-changed', ['--since', since, '--locale', locale, '--json'], async (route: string) => {
          if (route === 'document') return { document: scenarioDoc, documentId: 'parity', revision: index };
          throw new Error(`Unexpected API request: ${route}`);
        });
        expect(cli.documentId).toBe('parity');
        expect(cli.revision).toBe(index);
        const cliRows = cli.data.dishes as Array<Record<string, any>>;
        expect(cliRows).toHaveLength(ui.dishes.length);
        for (const row of ui.dishes) {
          const actual = cliRows.find(candidate => candidate.id === row.id)!;
          expect(actual.currentCost?.micro ?? null).toBe(row.currentCostMicro?.toString() ?? null);
          expect(actual.comparisonCost?.micro ?? null).toBe(row.comparisonCostMicro?.toString() ?? null);
          expect(actual.change?.cents ?? null).toBe(row.costDeltaCents?.toString() ?? null);
          expect(actual.monthlyImpact?.cents ?? null).toBe(row.monthlyImpactCents?.toString() ?? null);
          expect(actual.status).toBe(row.status);
          expect(actual.excludedReason).toBe(row.monthlyVolume === null ? 'no-volume' : row.monthlyImpactCents === null ? row.status : null);
          expect(actual.currentCost?.display ?? null).toBe(row.currentCostMicro === null ? null : formatEURFromMicroLocale(row.currentCostMicro, locale));
          expect(actual.comparisonCost?.display ?? null).toBe(row.comparisonCostMicro === null ? null : formatEURFromMicroLocale(row.comparisonCostMicro, locale));
          expect(actual.change?.display ?? null).toBe(row.costDeltaCents === null ? null : formatEURFromCentsLocale(row.costDeltaCents, locale));
          expect(actual.monthlyImpact?.display ?? null).toBe(row.monthlyImpactCents === null ? null : formatEURFromCentsLocale(row.monthlyImpactCents, locale));
        }
        expect((cli.data.totalMonthlyImpact as { cents: string } | null)?.cents ?? null).toBe(ui.totalMonthlyImpactCents?.toString() ?? null);
        expect((cli.data.totalMonthlyImpact as { display: string } | null)?.display ?? null).toBe(ui.totalMonthlyImpactCents === null ? null : formatEURFromCentsLocale(ui.totalMonthlyImpactCents, locale));
        expect(cli.data.excludedWithoutVolume).toBe(ui.excludedWithoutVolume);
        expect(cli.data.excludedWithVolume).toBe(ui.excludedWithVolume);
        expect(cli.data.averageFoodCost).toBe(ui.averageFoodCostTenthsPct === null ? null : formatPercentTenthsLocale(ui.averageFoodCostTenthsPct, locale));
        expect((cli.data.excluded as Array<{ id: string; reason: string }>).map(item => [item.id, item.reason])).toEqual(ui.dishes.filter(row => row.monthlyVolume === null || row.monthlyImpactCents === null).map(row => [row.id, row.monthlyVolume === null ? 'no-volume' : row.status]));
        scenarios++;
      }
    }
    expect(scenarios).toBe(70);
  });
});
