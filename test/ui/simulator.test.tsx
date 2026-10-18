import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compare, createBaselineSnapshot, formatEURFromCents, simulate,
} from '@/ui/domain/calc';
import type { MenuDocument, Overrides, Scenario } from '@/ui/domain/types';
import {
  demoCopy, go, memoryStorage, NOW, renderApp, savedDocument, storageWith,
} from './helpers';

/** The scenarios in storage, typed (the demo file has none, so its own type is an empty list). */
const savedScenarios = (storage: ReturnType<typeof memoryStorage>) => savedDocument(storage).scenarios as unknown as Scenario[];

const BURGER = 'dish_classic_burger';
const user = () => userEvent.setup();

beforeEach(() => {
  // The simulator takes its baseline "now": pin the clock to the moment the demo is written for.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  window.location.hash = '';
});
afterEach(() => { vi.useRealTimers(); });

async function open(hash: string, storage = memoryStorage()) {
  const view = renderApp(storage);
  await go(hash);
  await screen.findByRole('heading', { level: 1 });
  return { storage, view };
}

const scenario = (letter: string) => within(screen.getByRole('region', { name: `Scenario ${letter}` }));

async function addScenario(u: ReturnType<typeof user>) {
  await u.click(screen.getByRole('button', { name: /Add scenario/ }));
}

/** Text of a comparison-table cell: column 0 is Baseline, 1 is the first scenario. */
function cell(rowLabel: RegExp, column: number) {
  const table = within(screen.getByRole('table'));
  const row = table.getAllByRole('row').find((entry) => within(entry).queryByRole('rowheader', { name: rowLabel }));
  if (!row) throw new Error(`No table row ${rowLabel}`);
  return within(row).getAllByRole('cell')[column]?.textContent ?? '';
}

async function typeInto(u: ReturnType<typeof user>, field: HTMLElement, text: string) {
  await u.clear(field);
  if (text !== '') await u.type(field, text);
}

/** What calc says directly, for comparing with what the screen shows. */
function expected(overrides: Overrides) {
  const doc = demoCopy();
  const baseline = createBaselineSnapshot(doc as never, BURGER, NOW);
  const base = simulate(baseline, {});
  const result = simulate(baseline, overrides);
  const delta = compare(base, [result]).scenarios[0];
  if (!delta) throw new Error('no comparison');
  return { base, result, delta };
}

const OLD_PRICES = { // the burger's ingredients at the prices of 4 Aug (bun: 12 pieces for €9.60)
  'Beef mince': '14', 'Brioche burger bun': '9.60', 'Aged cheddar': '13', 'Smoked bacon': '9.04',
  Mayonnaise: '4', 'Canned tomatoes': '3', Onions: '6',
};

describe('Choosing a dish', () => {
  it('lists the dishes with their cost and links to the simulator', async () => {
    await open('#/simulator');
    expect(screen.getByRole('heading', { level: 1, name: 'Simulator' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Simulate Classic Burger' });
    expect(link.getAttribute('href')).toBe(`#/simulator/${BURGER}`);
    expect(link.textContent).toContain('€4.85');
    expect(link.textContent).toContain('No saved scenarios');
    expect(screen.queryByRole('link', { name: 'Simulate Burger sauce' })).toBeNull();
  });

  it('explains that a prep cannot be simulated, and shows "not found" for an unknown id', async () => {
    await open('#/simulator/prep_burger_sauce');
    expect(screen.getByRole('heading', { level: 1, name: /Burger sauce prep is a prep|is a prep/i })).toBeTruthy();
    expect(screen.getByText(/has no menu price to simulate/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Choose a dish' }).getAttribute('href')).toBe('#/simulator');

    await go('#/simulator/does_not_exist');
    expect(await screen.findByRole('heading', { level: 1, name: 'Not found' })).toBeTruthy();
    expect(screen.getByText(/this dish does not exist/i)).toBeTruthy();
  });
});

describe('Baseline', () => {
  it('shows the dish as it is today, with VAT labels and the monthly figure at 300 a month', async () => {
    await open(`#/simulator/${BURGER}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Simulator: Classic Burger' })).toBeTruthy();
    const baseline = within(screen.getByRole('region', { name: /Baseline/ }));
    expect(baseline.getByText('€13.08')).toBeTruthy();
    expect(baseline.getByText(/€12\.00 excl\. VAT/)).toBeTruthy();
    expect(baseline.getByText('€4.85')).toBeTruthy();
    expect(baseline.getByText('€7.15')).toBeTruthy();
    expect(baseline.getByText('40.4%')).toBeTruthy();
    expect(baseline.getByText(/Contribution margin 59\.6%/)).toBeTruthy();
    expect(baseline.getByText('€2145.00')).toBeTruthy();
    expect(baseline.getByText('before other costs')).toBeTruthy();
    expect(screen.getByLabelText('Expected sales per month (your estimate)')).toHaveProperty('value', '300');
  });

  it('a change to the shared sales estimate updates every figure, and a wrong one is refused', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    const volume = screen.getByLabelText('Expected sales per month (your estimate)');
    await typeInto(u, volume, '400');
    expect(within(screen.getByRole('region', { name: /Baseline/ })).getByText('€2860.00')).toBeTruthy();

    await u.type(volume, 'x');
    expect(screen.getByText('Enter a whole number of 0 or more, for example 300.')).toBeTruthy();
    expect(volume.getAttribute('aria-invalid')).toBe('true');
    // The last valid estimate keeps being used.
    expect(within(screen.getByRole('region', { name: /Baseline/ })).getByText('€2860.00')).toBeTruthy();

    await typeInto(u, volume, '');
    expect(screen.getByText(/Enter your estimate/)).toBeTruthy();
  });
});

describe('Scenarios recalculate as calc does', () => {
  it('menu price +€0.75 gives the same figures as simulate()', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/Menu price \(incl\. VAT/), '13.83');

    const { result, delta } = expected({ menuPriceInclVatCents: 1383 });
    expect(cell(/Menu price \(incl\. VAT\)/, 1)).toContain('€13.83');
    expect(cell(/Price excl\. VAT/, 1)).toContain(formatEURFromCents(result.netPriceCents));
    expect(cell(/Contribution per portion/, 1)).toContain(formatEURFromCents(result.contributionCents as bigint));
    expect(cell(/Contribution per portion/, 1)).toContain(`+${formatEURFromCents(delta.contributionDeltaCents as bigint)}`);
    expect(cell(/Estimated monthly contribution/, 1)).toContain(formatEURFromCents(result.monthlyContributionCents as bigint));
    expect(cell(/Estimated monthly contribution/, 1)).toContain(`+${formatEURFromCents(delta.monthlyContributionDeltaCents as bigint)}`);
    // Baseline column stays as it was.
    expect(cell(/Contribution per portion/, 0)).toBe('€7.15');
  });

  it('a patty of 160 g instead of 180 g lowers the cost, like simulate()', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/New net quantity of Beef mince/), '160');

    const { result, delta } = expected({ lineQtyMilli: { l1: 160_000 } });
    expect(cell(/Recipe-based ingredient cost/, 1)).toContain(formatEURFromCents(result.ingredientCostCents as bigint));
    expect(cell(/Recipe-based ingredient cost/, 1)).toContain(formatEURFromCents(delta.ingredientCostDeltaCents as bigint));
    expect(cell(/Estimated monthly contribution/, 1)).toContain(`+${formatEURFromCents(delta.monthlyContributionDeltaCents as bigint)}`);
  });

  it('a beef price back at €14 per kg lowers the cost by €0.54 (+€162.00 a month)', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/New pack price.* of Beef mince/), '14');
    expect(scenario('A').getByText(/That is/).textContent).toContain('€14.00/kg');

    const { delta } = expected({ ingredientPriceCents: { ing_beef: 1400 } });
    expect(formatEURFromCents(delta.contributionDeltaCents as bigint)).toBe('€0.54');
    expect(cell(/Contribution per portion/, 1)).toContain('+€0.54');
    expect(cell(/Estimated monthly contribution/, 1)).toContain('+€162.00');
  });

  it('the example from the brief: all earlier prices give cost €4.85 → €4.20, +€0.65 and +€195.00 a month', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    for (const [name, price] of Object.entries(OLD_PRICES)) {
      await typeInto(u, scenario('A').getByLabelText(new RegExp(`New pack price.* of ${name}`)), price);
    }
    expect(cell(/Recipe-based ingredient cost/, 0)).toBe('€4.85');
    expect(cell(/Recipe-based ingredient cost/, 1)).toContain('€4.20');
    expect(cell(/Contribution per portion/, 0)).toBe('€7.15');
    expect(cell(/Contribution per portion/, 1)).toContain('€7.80');
    expect(cell(/Contribution per portion/, 1)).toContain('+€0.65');
    expect(cell(/Estimated monthly contribution/, 1)).toContain('€2340.00');
    expect(cell(/Estimated monthly contribution/, 1)).toContain('+€195.00');
  });

  it('a price change reaches the burger through the sauce prep (mayonnaise)', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await u.click(scenario('A').getByText('Ingredient prices'));
    const row = within(scenario('A').getByRole('group', { name: 'Price of Mayonnaise' }));
    expect(row.getByText(/Used in: Burger sauce/)).toBeTruthy();
    await typeInto(u, row.getByLabelText(/New pack price/), '8');
    const { delta } = expected({ ingredientPriceCents: { ing_mayo: 800 } });
    expect(cell(/Recipe-based ingredient cost/, 1)).toContain(formatEURFromCents(delta.ingredientCostDeltaCents as bigint));
  });

  it('prep lines cannot be edited, and says why', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    expect(scenario('A').getByText(/Not editable here/)).toBeTruthy();
    expect(scenario('A').queryByLabelText(/New net quantity of Burger sauce/)).toBeNull();
  });

  it('the best scenario by monthly contribution is named in words', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/Menu price \(incl\. VAT/), '13.83');
    await typeInto(u, scenario('B').getByLabelText(/New net quantity of Beef mince/), '160');
    // A adds about €206 a month, B about €102: A is highest.
    expect(screen.getByTestId('highest-monthly').textContent).toMatch(/Scenario A has the highest estimated monthly contribution/);
    expect(screen.getByText(/Scenarios are calculations based on your inputs, not forecasts\./)).toBeTruthy();
    expect(screen.getAllByText(/may affect quality, food safety or allergen information/).length).toBeGreaterThan(0);
  });

  it('a scenario can have its own sales estimate', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/Own sales per month/), '100');
    expect(cell(/Sales per month/, 0)).toBe('300');
    expect(cell(/Sales per month/, 1)).toContain('100');
    expect(cell(/Estimated monthly contribution/, 1)).toContain('€715.00');
  });

  it('allows three scenarios at most', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await addScenario(u);
    await addScenario(u);
    const button = screen.getByRole('button', { name: 'Up to 3 scenarios' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('region', { name: /^Scenario [ABC]$/ })).toHaveLength(3);
  });
});

describe('Wrong input', () => {
  it('shows the error at the field and keeps the last valid result', async () => {
    const u = user();
    await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    const price = scenario('A').getByLabelText(/Menu price \(incl\. VAT/);
    await typeInto(u, price, '13.83');
    expect(cell(/Contribution per portion/, 1)).toContain('€7.84');

    await u.type(price, 'x');
    expect(price.getAttribute('aria-invalid')).toBe('true');
    expect(scenario('A').getByText(/Enter a non-negative amount with at most two decimal places/)).toBeTruthy();
    expect(cell(/Contribution per portion/, 1)).toContain('€7.84');

    await typeInto(u, price, '-3');
    expect(price.getAttribute('aria-invalid')).toBe('true');
    await typeInto(u, price, '13.8');
    expect(price.getAttribute('aria-invalid')).toBeNull();
    expect(cell(/Menu price \(incl\. VAT\)/, 1)).toContain('€13.80');
  });

  it('refuses a quantity of zero or one with too many decimals, and a save with an error', async () => {
    const u = user();
    const { storage } = await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    const qty = scenario('A').getByLabelText(/New net quantity of Beef mince/);
    await typeInto(u, qty, '0');
    expect(qty.getAttribute('aria-invalid')).toBe('true');
    await typeInto(u, qty, '1.2345');
    expect(qty.getAttribute('aria-invalid')).toBe('true');

    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));
    expect(storage.setCalls).toBe(0);
    expect(document.activeElement).toBe(qty);
  });

  it('refuses an empty name when saving', async () => {
    const u = user();
    const { storage } = await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await u.clear(scenario('A').getByLabelText('Scenario name'));
    expect(scenario('A').getByText('Give the scenario a name.')).toBeTruthy();
    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));
    expect(storage.setCalls).toBe(0);
  });
});

describe('The real data never changes', () => {
  it('editing scenarios writes nothing; saving changes only the scenarios', async () => {
    const u = user();
    const before = demoCopy();
    const { storage } = await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/Menu price \(incl\. VAT/), '15');
    await u.click(scenario('A').getByText('Ingredient prices'));
    await typeInto(u, scenario('A').getByLabelText(/New pack price.* of Beef mince/), '20');
    await typeInto(u, scenario('A').getByLabelText(/New net quantity of Beef mince/), '100');
    expect(storage.setCalls).toBe(0);

    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));
    const after = savedDocument(storage);
    const { scenarios, ...rest } = after as MenuDocument & typeof after;
    const { scenarios: beforeScenarios, ...beforeRest } = before;
    expect(rest).toEqual(beforeRest);
    expect(beforeScenarios).toEqual([]);
    expect(scenarios).toHaveLength(1);
  });
});

describe('Saving scenarios', () => {
  it('saves, reloads with the scenario in place, then deletes it after confirming', async () => {
    const u = user();
    const { storage, view } = await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText('Scenario name'), 'Raise the price');
    await typeInto(u, scenario('A').getByLabelText(/Menu price \(incl\. VAT/), '13.83');
    expect(scenario('A').getByText('Not saved yet.')).toBeTruthy();
    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));
    expect(scenario('A').getByText('Saved.')).toBeTruthy();

    const saved = savedScenarios(storage)[0];
    expect(saved).toMatchObject({
      recipeId: BURGER, name: 'Raise the price', overrides: { menuPriceInclVatCents: 1383, ingredientPriceCents: {}, lineQtyMilli: {} },
    });
    expect(saved?.baseline.recipeId).toBe(BURGER);
    expect(saved?.baseline.takenAt).toBe(NOW);

    // Close and open the app again on the same storage.
    view.unmount();
    renderApp(storage);
    await go(`#/simulator/${BURGER}`);
    await screen.findByRole('heading', { level: 1, name: 'Simulator: Classic Burger' });
    expect(scenario('A').getByLabelText('Scenario name')).toHaveProperty('value', 'Raise the price');
    expect(scenario('A').getByLabelText(/Menu price \(incl\. VAT/)).toHaveProperty('value', '13.83');
    expect(cell(/Contribution per portion/, 1)).toContain('€7.84');
    expect(scenario('A').queryByText(/Baseline changed/)).toBeNull();

    await u.click(scenario('A').getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Your recipes and ingredient prices are not changed/)).toBeTruthy();
    await u.click(within(dialog).getByRole('button', { name: 'Delete scenario' }));
    expect(savedScenarios(storage)).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Scenario A' })).toBeNull();
    expect(screen.getByText('No scenarios yet')).toBeTruthy();
  });

  it('a failed save keeps what was typed, shows why, and works again later', async () => {
    const u = user();
    const storage = memoryStorage();
    await open(`#/simulator/${BURGER}`, storage);
    await addScenario(u);
    await typeInto(u, scenario('A').getByLabelText(/Menu price \(incl\. VAT/), '14');
    storage.failOnSet = new DOMException('full', 'QuotaExceededError');
    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));

    expect(scenario('A').getByRole('alert').textContent).toMatch(/storage is full/i);
    expect(scenario('A').getByLabelText(/Menu price \(incl\. VAT/)).toHaveProperty('value', '14');
    expect(scenario('A').getByText('Not saved yet.')).toBeTruthy();
    expect(cell(/Menu price \(incl\. VAT\)/, 1)).toContain('€14.00');

    storage.failOnSet = null;
    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));
    expect(savedScenarios(storage)).toHaveLength(1);
    expect(scenario('A').queryByRole('alert')).toBeNull();
  });

  it('removing an unsaved scenario needs no confirmation and writes nothing', async () => {
    const u = user();
    const { storage } = await open(`#/simulator/${BURGER}`);
    await addScenario(u);
    await u.click(scenario('A').getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('region', { name: 'Scenario A' })).toBeNull();
    expect(storage.setCalls).toBe(0);
  });
});

describe('Baseline changed', () => {
  async function saveScenarioWith(u: ReturnType<typeof user>, storage: ReturnType<typeof memoryStorage>) {
    await open(`#/simulator/${BURGER}`, storage);
    await addScenario(u);
    await u.click(scenario('A').getByText('Ingredient prices'));
    await typeInto(u, scenario('A').getByLabelText(/New pack price.* of Beef mince/), '16');
    await u.click(scenario('A').getByRole('button', { name: 'Save scenario' }));
  }

  it('shows a banner after an ingredient price changes, and "Update baseline" brings the scenario up to date', async () => {
    const u = user();
    const storage = memoryStorage();
    await saveScenarioWith(u, storage);
    expect(scenario('A').queryByText('Baseline changed since this scenario was saved')).toBeNull();

    // The supplier raises the price of mayonnaise (used inside the sauce): a new price on Ingredients.
    await go('#/ingredients');
    await u.click(await screen.findByRole('button', { name: 'New price for Mayonnaise' }));
    const dialog = await screen.findByRole('dialog');
    await u.type(within(dialog).getByLabelText(/Pack price/), '5');
    await u.click(within(dialog).getByRole('button', { name: 'Save price' }));

    await go(`#/simulator/${BURGER}`);
    await screen.findByRole('heading', { level: 1, name: 'Simulator: Classic Burger' });
    expect(scenario('A').getByText('Baseline changed since this scenario was saved')).toBeTruthy();
    expect(cell(/Recipe-based ingredient cost/, 1)).toBeTruthy();
    expect(screen.getAllByText(/older prices/).length).toBeGreaterThan(0);

    await u.click(scenario('A').getByRole('button', { name: 'Update baseline' }));
    expect(scenario('A').queryByText('Baseline changed since this scenario was saved')).toBeNull();
    // The beef price change is kept; the scenario is saved on today's data.
    const saved = savedScenarios(storage)[0];
    expect(saved?.overrides.ingredientPriceCents).toEqual({ ing_beef: 1600 });
    expect(saved?.baseline.ingredients.find((entry) => entry.id === 'ing_mayo')?.prices.at(-1)?.packPriceCents).toBe(500);
    expect(scenario('A').getByLabelText(/New pack price.* of Beef mince/)).toHaveProperty('value', '16.00');
    expect(screen.queryByText(/older prices/)).toBeNull();
  });

  it('drops a change that no longer applies and says which', async () => {
    const u = user();
    const doc = demoCopy();
    const oldBaseline = createBaselineSnapshot(doc as never, BURGER, NOW);
    doc.scenarios = [{
      id: 'scn_old', recipeId: BURGER, name: 'Less bacon', createdAt: NOW,
      baseline: structuredClone(oldBaseline) as never,
      overrides: { ingredientPriceCents: { ing_beef: 1600 }, lineQtyMilli: { l5: 20_000 } },
    }] as never;
    // Bacon is taken out of the dish after the scenario was saved.
    const dish = doc.recipes.find((recipe) => recipe.id === BURGER);
    if (!dish) throw new Error('no burger');
    dish.lines = dish.lines.filter((line) => line.id !== 'l5');
    const storage = storageWith(doc);

    await open(`#/simulator/${BURGER}`, storage);
    expect(scenario('A').getByText('Baseline changed since this scenario was saved')).toBeTruthy();
    await u.click(scenario('A').getByRole('button', { name: 'Update baseline' }));

    expect(scenario('A').getByText(/Some changes no longer apply/)).toBeTruthy();
    expect(scenario('A').getByText(/the quantity change for Smoked bacon/)).toBeTruthy();
    const saved = savedScenarios(storage)[0];
    expect(saved?.overrides.lineQtyMilli).toEqual({});
    expect(saved?.overrides.ingredientPriceCents).toEqual({ ing_beef: 1600 });
    await u.click(scenario('A').getByRole('button', { name: 'OK' }));
    expect(scenario('A').queryByText(/Some changes no longer apply/)).toBeNull();
  });
});
