import { test, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalPlans } from '@/ui/data/LocalPlans';
import { LocalModeContext } from '@/ui/data/localMode';
import { LocaleProvider } from '@/ui/i18n/LocaleProvider';
import { LOCALE_KEY } from '@/ui/i18n/preferences';
import { memoryStorage } from './helpers';
const plan = { id: 'plan1', status: 'pending', ingredient: { id: 'i1', name: 'Flour', unit: 'g' }, source: 'cli', expiresAt: '2099-01-01T12:00:00Z',
  price: { packPriceCents: '1800', packSizeMilli: 1000000 }, previousPrice: null,
  proposedPrice: { packPriceCents: '1800', packSizeMilli: 1000000, unitPrice: { cents: '1800', per: 'kg' } },
  effects: { dishes: [], preps: [], totalMonthlyImpactCents: null, excludedWithoutVolume: 0, excludedWithVolume: 0 } };
afterEach(() => vi.unstubAllGlobals());
function mount(locale = 'en') { return render(<LocaleProvider storage={memoryStorage({ [LOCALE_KEY]: locale })}><LocalModeContext.Provider value={{ dataDir: '/tmp', token: 'a'.repeat(64), connection: null }}><LocalPlans /></LocalModeContext.Provider></LocaleProvider>); }
test('plans panel requires focused confirmation before applying and reports success', async () => {
  const user = userEvent.setup();
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url); return new Response(JSON.stringify(url.endsWith('/apply') ? { receipt: {} } : { plans: [plan] }), { status: 200 });
  }));
  mount(); await screen.findByRole('heading', { name: 'Awaiting your confirmation' });
  expect(screen.getByText(/€18.00\/kg/)).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /^Apply$/ }));
  expect(calls.some(url => url.endsWith('/apply'))).toBe(false);
  const dialog = screen.getByRole('alertdialog'); expect(dialog.contains(document.activeElement)).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await waitFor(() => expect(calls.some(url => url.endsWith('/apply'))).toBe(true));
  await screen.findByText('Price applied.');
});
test('plans panel shows stale/expired advice and does not enable apply', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ plans: [{ ...plan, status: 'stale' }, { ...plan, id: 'p2', status: 'expired' }] }), { status: 200 })));
  mount(); await screen.findByText('Inactive proposals (2)');
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  await userEvent.click(screen.getByText('Inactive proposals (2)'));
  expect(screen.getByText('Data changed after this proposal was made.')).toBeTruthy();
  expect(screen.getByText('This proposal expired after 24 hours.')).toBeTruthy();
  expect(screen.getByText('Ask the agent to propose again.')).toBeTruthy();
});

test('plans rejection has its own confirmation and stale apply failure stays visible', async () => {
  const user = userEvent.setup(); const actions: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/apply')) return new Response(JSON.stringify({ code: 'plan-stale', message: 'stale' }), { status: 400 });
    if (url.endsWith('/reject')) actions.push('reject');
    return new Response(JSON.stringify(url.endsWith('/reject') ? { ...plan, status: 'rejected' } : { plans: [plan] }), { status: 200 });
  }));
  mount(); await screen.findByRole('button', { name: /^Apply$/ });
  await user.click(screen.getByRole('button', { name: /^Apply$/ }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await screen.findByText('Data changed. Ask the agent to propose again.');
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: /^Reject$/ }));
  expect(actions).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));
  await screen.findByText('Proposal rejected.'); expect(actions).toEqual(['reject']);
});


test('plans keep unknown amounts and null total distinct from zero in EN and NL', async () => {
  const row = { id: 'dish', name: 'Unknown dish', comparisonCostMicro: null, currentCostMicro: '0', comparisonFoodCostTenthsPct: null, currentFoodCostTenthsPct: null, monthlyImpactCents: null, excludedReason: 'cost-unknown' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ plans: [{ ...plan, effects: { ...plan.effects, dishes: [row] } }] }))));
  for (const locale of ['en', 'nl']) {
    const rendered = mount(locale);
    await screen.findByText('Unknown dish');
    const panel = screen.getByTestId('plans-panel');
    expect(panel.textContent).toContain(locale === 'nl' ? 'excl. btw' : 'excl. VAT');
    expect(panel.textContent?.toLowerCase()).toContain(locale === 'nl' ? 'kosten onbekend' : 'cost unknown');
    expect(screen.getByText(locale === 'nl' ? 'Verandering in maandelijkse bijdrage van het menu: —' : 'Menu monthly contribution change: —')).toBeTruthy();
    expect(screen.getAllByText(locale === 'nl' ? /€\s0,00/ : /€0.00/)).toHaveLength(1);
    rendered.unmount();
  }
});

test('plans bound cards, paginate, show inactive reasons and confirm reject all', async () => {
  const user = userEvent.setup(), calls: string[] = [];
  const plans = Array.from({ length: 5 }, (_, i) => ({ ...plan, id: 'p' + i, ingredient: { ...plan.ingredient, name: 'Flour ' + i } }));
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/reject')) { calls.push(JSON.parse(String(options?.body)).id); return new Response('{}'); }
    return new Response(JSON.stringify({ plans: [...plans, { ...plan, status: 'expired' }, { ...plan, id: 'old', status: 'rejected' }] }));
  }));
  mount(); await screen.findByRole('button', { name: '2 more' });
  expect(screen.getAllByRole('article')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: '2 more' }));
  expect(screen.getAllByRole('article')).toHaveLength(2);
  await user.click(screen.getByText('Inactive proposals (2)'));
  expect(screen.getByText('This proposal expired after 24 hours.')).toBeTruthy();
  expect(screen.getByText('Rejected by you.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Reject all' }));
  expect(calls).toEqual([]); expect(screen.getByRole('alertdialog').textContent).toContain('5 proposals');
  await user.click(screen.getByRole('button', { name: 'Confirm rejection' }));
  await screen.findByText('Proposal rejected.'); expect(calls.sort()).toEqual(plans.map(p => p.id).sort());
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('plan warnings are localized in card and dialog, Escape returns focus, double click writes once', async () => {
  const user = userEvent.setup(); let writes = 0;
  let finish!: () => void;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/apply')) { writes++; await new Promise<void>(resolve => { finish = resolve; }); return new Response('{}'); }
    return new Response(JSON.stringify({ plans: [{ ...plan, warnings: [{ code: 'zero-price', message: 'zero' }, { code: 'large-price-change', message: 'ratio' }] }] }));
  }));
  mount('nl'); const apply = await screen.findByRole('button', { name: 'Toepassen' });
  expect(screen.getByText(/meer dan ×3/)).toBeTruthy(); expect(screen.getByText(/leveranciersprijs is nul/)).toBeTruthy();
  await user.click(apply);
  expect(within(screen.getByRole('alertdialog')).getByText(/meer dan ×3/)).toBeTruthy();
  await user.keyboard('{Escape}'); expect(document.activeElement).toBe(apply);
  await user.click(apply); await user.dblClick(screen.getByRole('button', { name: 'Toepassen bevestigen' }));
  expect(writes).toBe(1); await act(async () => finish());
  await screen.findByText('Prijs toegepast.');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Recente voorstellen' }));
});

test.each(['plan-expired', 'connection-failed'])('plan failure %s stays in confirmation without claiming success', async code => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/apply')) {
      if (code === 'connection-failed') throw new Error('offline');
      return new Response(JSON.stringify({ code, message: 'expired' }), { status: 409 });
    }
    return new Response(JSON.stringify({ plans: [plan] }));
  }));
  mount(); await user.click(await screen.findByRole('button', { name: 'Apply' }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain(code === 'plan-expired' ? 'This plan expired. Ask the agent' : 'Could not complete');
  expect(screen.getByRole('alertdialog')).toBeTruthy(); expect(screen.queryByText('Price applied.')).toBeNull();
});

test('subscribe reveals new proposals, reports connection loss and recovers', async () => {
  let state = 0;
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (state === 2) throw new Error('offline');
    return new Response(JSON.stringify({ plans: state === 0 ? [] : [plan] }));
  }));
  mount(); await act(async () => {}); expect(screen.queryByTestId('plans-panel')).toBeNull();
  state = 1;
  await screen.findByRole('button', { name: 'Apply' }, { timeout: 3000 });
  state = 2; await screen.findByText(/Could not load proposals/, {}, { timeout: 3000 });
  state = 1; await waitFor(() => expect(screen.queryByText(/Could not load proposals/)).toBeNull(), { timeout: 3000 });
}, 10000);

test('success notice disappears after its timeout', async () => {
  const user = userEvent.setup(); let applied = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/apply')) { applied = true; return new Response('{}'); }
    return new Response(JSON.stringify({ plans: applied ? [] : [plan] }));
  }));
  mount(); await user.click(await screen.findByRole('button', { name: 'Apply' }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await screen.findByText('Price applied.');
  await waitFor(() => expect(screen.queryByText('Price applied.')).toBeNull(), { timeout: 6000 });
}, 8000);

test.each(['en', 'nl'])('plan card labels both pack and unit prices excluding VAT (%s)', async locale => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ plans: [plan] }))));
  mount(locale);
  const card = await screen.findByRole('article');
  const label = locale === 'nl' ? 'excl. btw' : 'excl. VAT';
  for (const text of [locale === 'nl' ? 'per verpakking' : 'per pack', '/kg']) {
    const paragraph = within(card).getByText((_content, el) => el?.tagName === 'P' && Boolean(el.textContent?.includes(text)));
    expect(paragraph.textContent).toContain(label);
  }
});

test('mobile plans show one card per page and respond to desktop resizing', async () => {
  const user = userEvent.setup();
  let listener!: () => void;
  const media = { matches: true, addEventListener: (_event: string, callback: () => void) => { listener = callback; }, removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const plans = Array.from({ length: 4 }, (_, i) => ({ ...plan, id: 'p' + i, ingredient: { ...plan.ingredient, name: 'Flour ' + i } }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ plans }))));
  const rendered = mount();
  await screen.findByRole('button', { name: '3 more' });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: '3 more' }));
  expect(screen.getByRole('article').textContent).toContain('Flour 1');
  expect(screen.getByRole('button', { name: '2 more' })).toBeTruthy();
  act(() => { media.matches = false; listener(); });
  expect(screen.getAllByRole('article')).toHaveLength(3);
  rendered.unmount(); expect(media.removeEventListener).toHaveBeenCalled();
});
