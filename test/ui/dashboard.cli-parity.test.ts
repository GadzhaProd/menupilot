import { describe, expect, it } from 'vitest';
import enSource from '../../data/demo.json';
import nlSource from '../../data/demo.nl.json';
import { dashboardData } from '../../src/ui/domain/dashboard';
// @ts-expect-error JS CLI module is exercised as an integration boundary.
import { executeReadCommand } from '../../server/cliRead.js';

describe('CLI Dashboard parity', () => {
  it('uses the UI Dashboard adapter for 70 EN/NL data and date scenarios', async () => {
    let scenarios = 0;
    for (const source of [enSource, nlSource]) {
      for (let index = 0; index < 35; index++) {
        const offset = index * 86_400_000;
        const doc = structuredClone(source) as typeof source;
        if (index === 1) doc.recipes.find((recipe) => recipe.kind === 'dish')!.monthlyVolume = 0;
        if (index === 2) doc.recipes.find((recipe) => recipe.kind === 'dish')!.menuPriceInclVatCents = 0;
        if (index === 3) doc.ingredients[0]!.prices = [];
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const date = new Date(today.getTime() - offset).toISOString().slice(0, 10);
        const asOf = `${date}T23:59:59.999Z`;
        const ui = dashboardData(doc as never, asOf);
        const cli = await executeReadCommand('what-changed', ['--since', date, '--locale', source === nlSource ? 'nl' : 'en', '--json'], async (route: string) => {
          if (route === 'document') return { document: doc, documentId: 'parity', revision: index };
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
        }
        expect((cli.data.totalMonthlyImpact as { cents: string } | null)?.cents ?? null).toBe(ui.totalMonthlyImpactCents?.toString() ?? null);
        scenarios++;
      }
    }
    expect(scenarios).toBe(70);
  });
});
